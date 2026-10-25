"use server";

import { run } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { nextNumber } from "@/lib/access";
import { audit } from "@/lib/audit";
import { decimalOrNull, money, num, round2, str } from "@/lib/format";
import { invoiceTotals } from "@/lib/finance";
import { DEFAULT_SCHEDULE, PAYMENT_METHOD_LABELS } from "@/lib/constants";

/** §14 et §18 — Contrat d'honoraires et échéancier lié aux étapes. */
export async function saveContract(projectId: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageFinance");
    const amountHT = decimalOrNull(fd, "amountHT");
    const vatRate = decimalOrNull(fd, "vatRate") ?? 20;
    if (amountHT == null || amountHT <= 0) throw new Error("Montant HT invalide.");
    const signedAt = str(fd, "signedAt");
    const existing = await prisma.contract.findUnique({ where: { projectId } });
    const data = { amountHT, vatRate, signedAt: signedAt ? new Date(signedAt) : null, notes: str(fd, "notes") };
    if (existing) {
      await prisma.contract.update({ where: { projectId }, data });
      await audit(user, {
        entity: "Contrat", entityId: existing.id, projectId, action: "avenant",
        summary: `Honoraires modifiés : ${money(existing.amountHT)} HT → ${money(amountHT)} HT${data.notes ? ` (${data.notes})` : ""}`,
      });
    } else {
      const c = await prisma.contract.create({
        data: {
          projectId, ...data,
          milestones: { create: DEFAULT_SCHEDULE.map((m, i) => ({ order: i + 1, label: m.label, percent: m.percent, step: m.step })) },
        },
      });
      await audit(user, { entity: "Contrat", entityId: c.id, projectId, action: "création", summary: `Honoraires fixés à ${money(amountHT)} HT, échéancier type créé` });
    }
    revalidatePath(`/projets/${projectId}/finances`);
  });
}

export async function saveSchedule(projectId: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageFinance");
    const contract = await prisma.contract.findUniqueOrThrow({ where: { projectId }, include: { milestones: { include: { _count: { select: { invoices: true } } } } } });
    const ids = fd.getAll("mid").map(String);
    const rows = ids.map((mid, i) => ({
      id: mid,
      label: String(fd.getAll("label")[i] ?? "").trim(),
      percent: Number(String(fd.getAll("percent")[i] ?? "0").replace(",", ".")),
      step: Number(fd.getAll("step")[i]) || null,
      dueDate: String(fd.getAll("dueDate")[i] ?? "") || null,
      remove: fd.getAll("remove").map(String).includes(mid),
    }));
    const kept = rows.filter((r) => !r.remove && r.label);
    const total = round2(kept.reduce((s, r) => s + (Number.isFinite(r.percent) ? r.percent : 0), 0));
    if (Math.abs(total - 100) > 0.01) throw new Error(`Le total de l'échéancier doit faire 100 % (actuellement ${total} %).`);

    await prisma.$transaction(async (tx) => {
      for (const [i, r] of rows.entries()) {
        const data = { order: i + 1, label: r.label, percent: r.percent, step: r.step, dueDate: r.dueDate ? new Date(r.dueDate) : null };
        if (r.id.startsWith("new")) {
          if (!r.remove && r.label) await tx.milestone.create({ data: { contractId: contract.id, ...data } });
        } else if (r.remove || !r.label) {
          const m = contract.milestones.find((x) => x.id === r.id);
          if (m && m._count.invoices > 0) throw new Error(`L'échéance « ${m.label} » est déjà facturée : elle ne peut pas être supprimée.`);
          await tx.milestone.delete({ where: { id: r.id } });
        } else {
          await tx.milestone.update({ where: { id: r.id }, data });
        }
      }
    });
    await audit(user, {
      entity: "Contrat", entityId: contract.id, projectId, action: "échéancier",
      summary: `Échéancier mis à jour : ${kept.map((r) => `${r.label} ${r.percent} %`).join(", ")}`,
    });
    revalidatePath(`/projets/${projectId}/finances`);
  });
}

/** Prépare une facture (brouillon) depuis une échéance ou librement. */
export async function createInvoice(projectId: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageFinance");
    const contract = await prisma.contract.findUnique({ where: { projectId }, include: { milestones: true } });
    const milestoneId = str(fd, "milestoneId");
    const milestone = contract?.milestones.find((m) => m.id === milestoneId);
    let amountHT = decimalOrNull(fd, "amountHT");
    if (amountHT == null && milestone && contract) amountHT = round2((num(contract.amountHT) * num(milestone.percent)) / 100);
    if (amountHT == null || amountHT <= 0) throw new Error("Montant HT invalide.");
    const object = str(fd, "object") ?? (milestone ? `Honoraires — ${milestone.label} (${num(milestone.percent)} %)` : "Honoraires d'architecte");
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const inv = await prisma.invoice.create({
      data: {
        projectId, milestoneId: milestone?.id ?? null, object, amountHT,
        vatRate: decimalOrNull(fd, "vatRate") ?? num(contract?.vatRate ?? settings?.vatRate ?? 20),
      },
    });
    await audit(user, { entity: "Facture", entityId: inv.id, projectId, action: "préparation", summary: `Facture préparée : ${object}, ${money(amountHT)} HT` });
    redirect(`/factures/${inv.id}`);
  });
}

export async function updateDraft(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageFinance");
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    if (inv.status !== "BROUILLON") throw new Error("Une facture émise ne peut plus être modifiée. Annulez-la et émettez-en une nouvelle.");
    const amountHT = decimalOrNull(fd, "amountHT");
    if (amountHT == null || amountHT <= 0) throw new Error("Montant HT invalide.");
    await prisma.invoice.update({
      where: { id },
      data: { object: str(fd, "object") ?? inv.object, amountHT, vatRate: decimalOrNull(fd, "vatRate") ?? inv.vatRate },
    });
    revalidatePath(`/factures/${id}`);
  });
}

export async function deleteDraft(id: string) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageFinance");
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    if (inv.status !== "BROUILLON") throw new Error("Une facture émise ne peut pas être supprimée.");
    await prisma.invoice.delete({ where: { id } });
    await audit(user, { entity: "Facture", entityId: id, projectId: inv.projectId, action: "suppression", summary: `Brouillon supprimé : ${inv.object}` });
    redirect(`/projets/${inv.projectId}/finances`);
  });
}

/** Émission : attribue le numéro légal continu (FA-AAAA-NNNN) et fige la facture. */
export async function issueInvoice(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageFinance");
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    if (inv.status !== "BROUILLON") return;
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const issue = str(fd, "issueDate") ? new Date(str(fd, "issueDate")!) : new Date();
    const due = str(fd, "dueDate") ? new Date(str(fd, "dueDate")!) : new Date(issue.getTime() + (settings?.paymentDays ?? 30) * 86400000);
    // Numéro et émission dans la même transaction : un double clic ou un échec ne laisse ni trou ni doublon.
    const number = await prisma.$transaction(async (tx) => {
      const n = await nextNumber("FA", issue.getFullYear(), 4, tx);
      const r = await tx.invoice.updateMany({ where: { id, status: "BROUILLON" }, data: { status: "EMISE", number: n, issueDate: issue, dueDate: due } });
      if (r.count === 0) throw new Error("Cette facture vient déjà d'être émise.");
      return n;
    });
    await audit(user, { entity: "Facture", entityId: id, projectId: inv.projectId, action: "émission", summary: `Facture ${number} émise : ${money(inv.amountHT)} HT` });
    revalidatePath(`/factures/${id}`);
  });
}

export async function cancelInvoice(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "cancelInvoice");
    const reason = str(fd, "reason");
    if (!reason) throw new Error("Le motif d'annulation est obligatoire.");
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id }, include: { payments: true } });
    if (inv.payments.length) throw new Error("Cette facture a des règlements : supprimez-les ou émettez un avoir.");
    await prisma.invoice.update({ where: { id }, data: { status: "ANNULEE", cancelReason: reason } });
    await audit(user, { entity: "Facture", entityId: id, projectId: inv.projectId, action: "annulation", summary: `Facture ${inv.number} annulée : ${reason}` });
    revalidatePath(`/factures/${id}`);
  });
}

/** §17 — Règlements, partiels compris. */
export async function addPayment(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageFinance");
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id }, include: { payments: true } });
    if (inv.status !== "EMISE") throw new Error("Seule une facture émise peut recevoir un règlement.");
    const amount = decimalOrNull(fd, "amount");
    const { due } = invoiceTotals(inv);
    if (amount == null || amount <= 0) throw new Error("Montant invalide.");
    if (amount > due + 0.004) throw new Error(`Le règlement dépasse le reste dû (${money(due)}).`);
    const method = (str(fd, "method") ?? "VIREMENT") as PaymentMethod;
    const date = str(fd, "date");
    const p = await prisma.payment.create({
      data: { invoiceId: id, amount, method, reference: str(fd, "reference"), date: date ? new Date(date) : new Date(), userName: user.name },
    });
    await audit(user, {
      entity: "Règlement", entityId: p.id, projectId: inv.projectId, action: "encaissement",
      summary: `${money(amount)} reçu sur ${inv.number} (${PAYMENT_METHOD_LABELS[method]}${p.reference ? ` ${p.reference}` : ""})`,
    });
    revalidatePath(`/factures/${id}`);
  });
}

export async function deletePayment(paymentId: string) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "cancelInvoice");
    const p = await prisma.payment.delete({ where: { id: paymentId }, include: { invoice: true } });
    await audit(user, { entity: "Règlement", entityId: paymentId, projectId: p.invoice.projectId, action: "suppression", summary: `Règlement de ${money(p.amount)} supprimé sur ${p.invoice.number}` });
    revalidatePath(`/factures/${p.invoiceId}`);
  });
}

export async function addReminder(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageFinance");
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    const channel = str(fd, "channel") ?? "Téléphone";
    await prisma.reminder.create({ data: { invoiceId: id, channel, note: str(fd, "note"), userName: user.name } });
    await audit(user, { entity: "Facture", entityId: id, projectId: inv.projectId, action: "relance", summary: `Relance ${channel.toLowerCase()} pour ${inv.number}` });
    revalidatePath(`/factures/${id}`);
  });
}
