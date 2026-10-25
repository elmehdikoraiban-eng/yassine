"use server";

import { run } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { nextNumber } from "@/lib/access";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { decimalOrNull, money, str } from "@/lib/format";
import { quoteTotals, QUOTE_STATUS_LABELS } from "@/lib/quote";
import { DEFAULT_SCHEDULE } from "@/lib/constants";

const toNum = (v: FormDataEntryValue | undefined) => {
  const x = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(x) ? x : NaN;
};

/** Lit l'en-tête et les lignes du formulaire de devis. */
function quoteData(fd: FormData) {
  const clientId = str(fd, "clientId");
  const object = str(fd, "object");
  if (!clientId || !object) throw new Error("Le client et l'objet du devis sont obligatoires.");
  const labels = fd.getAll("line_label").map((v) => String(v).trim());
  const qty = fd.getAll("line_qty"), units = fd.getAll("line_unit"), prices = fd.getAll("line_price");
  const lines = labels
    .map((label, i) => ({ label, quantity: toNum(qty[i]), unit: String(units[i] ?? "").trim() || null, unitPrice: toNum(prices[i]) }))
    .filter((l) => l.label);
  if (lines.length === 0) throw new Error("Ajoutez au moins une ligne au devis.");
  if (lines.some((l) => !(l.quantity > 0) || !(l.unitPrice >= 0))) throw new Error("Chaque ligne doit avoir une quantité et un prix valides.");
  const validUntil = str(fd, "validUntil");
  return {
    header: {
      clientId, object,
      issueDate: str(fd, "issueDate") ? new Date(str(fd, "issueDate")!) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      vatRate: decimalOrNull(fd, "vatRate") ?? 20,
      notes: str(fd, "notes"),
    },
    lines: lines.map((l, i) => ({ ...l, order: i + 1 })),
  };
}

export async function createQuote(fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageFinance");
    const { header, lines } = quoteData(fd);
    const number = await nextNumber("DV");
    const q = await prisma.quote.create({ data: { ...header, number, lines: { create: lines } } });
    await audit(user, { entity: "Devis", entityId: q.id, action: "création", summary: `Devis ${number} « ${q.object} » : ${money(quoteTotals(lines, header.vatRate).ht)} HT` });
    redirect(`/devis/${q.id}`);
  });
}

export async function updateQuote(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageFinance");
    const q = await prisma.quote.findUniqueOrThrow({ where: { id } });
    if (q.status === "ACCEPTE" || q.status === "REFUSE") throw new Error("Un devis accepté ou refusé ne se modifie plus : dupliquez-le.");
    const { header, lines } = quoteData(fd);
    await prisma.$transaction([
      prisma.quoteLine.deleteMany({ where: { quoteId: id } }),
      prisma.quote.update({ where: { id }, data: { ...header, lines: { create: lines } } }),
    ]);
    await audit(user, { entity: "Devis", entityId: id, action: "modification", summary: `Devis ${q.number} modifié : ${money(quoteTotals(lines, header.vatRate).ht)} HT` });
    redirect(`/devis/${id}`);
  });
}

export async function setQuoteStatus(id: string, status: QuoteStatus) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageFinance");
    const q = await prisma.quote.findUniqueOrThrow({ where: { id } });
    if (q.projectId && status !== "ACCEPTE") throw new Error("Ce devis a déjà donné lieu à un projet.");
    await prisma.quote.update({ where: { id }, data: { status } });
    await audit(user, { entity: "Devis", entityId: id, action: "statut", summary: `Devis ${q.number} : ${QUOTE_STATUS_LABELS[status]}` });
    revalidatePath(`/devis/${id}`);
  });
}

export async function duplicateQuote(id: string) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageFinance");
    const q = await prisma.quote.findUniqueOrThrow({ where: { id }, include: { lines: true } });
    const number = await nextNumber("DV");
    const copy = await prisma.quote.create({
      data: {
        number, clientId: q.clientId, object: q.object, vatRate: q.vatRate, notes: q.notes,
        validUntil: new Date(Date.now() + 30 * 86400000),
        lines: { create: q.lines.map(({ order, label, quantity, unit, unitPrice }) => ({ order, label, quantity, unit, unitPrice })) },
      },
    });
    await audit(user, { entity: "Devis", entityId: copy.id, action: "création", summary: `Devis ${number} créé à partir de ${q.number}` });
    redirect(`/devis/${copy.id}/modifier`);
  });
}

export async function deleteQuote(id: string) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageFinance");
    const q = await prisma.quote.findUniqueOrThrow({ where: { id } });
    if (q.status !== "BROUILLON") throw new Error("Seul un devis en préparation peut être supprimé.");
    await prisma.quote.delete({ where: { id } });
    await audit(user, { entity: "Devis", entityId: id, action: "suppression", summary: `Devis ${q.number} supprimé` });
    redirect("/devis");
  });
}

/** Devis accepté → projet (nouveau ou existant du client) avec contrat d'honoraires et échéancier type. */
export async function convertQuote(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageFinance");
    assertCan(user, "manageProjects");
    const q = await prisma.quote.findUniqueOrThrow({ where: { id }, include: { lines: true } });
    if (q.status !== "ACCEPTE") throw new Error("Le devis doit d'abord être marqué comme accepté.");
    if (q.projectId) throw new Error("Ce devis est déjà rattaché à un projet.");
    const t = quoteTotals(q.lines, q.vatRate);
    const target = str(fd, "target") ?? "new";
    const memberIds = fd.getAll("members").map(String);
    let projectId: string;
    if (target === "new") {
      const reference = await nextNumber("P");
      const p = await prisma.project.create({
        data: {
          reference, name: str(fd, "name") ?? q.object, clientId: q.clientId,
          members: { create: [...new Set([user.id, ...memberIds])].map((userId) => ({ userId })) },
        },
      });
      projectId = p.id;
      await audit(user, { entity: "Projet", entityId: p.id, projectId: p.id, action: "création", summary: `Dossier ${reference} « ${p.name} » ouvert depuis le devis ${q.number}` });
      await notify(user, memberIds, { title: `Nouveau projet : ${p.name}`, body: `Devis ${q.number} accepté, vous êtes affecté au dossier ${reference}.`, href: `/projets/${p.id}` });
    } else {
      const p = await prisma.project.findFirst({ where: { id: target, clientId: q.clientId }, include: { contract: true } });
      if (!p) throw new Error("Projet introuvable pour ce client.");
      if (p.contract) throw new Error("Ce projet a déjà un contrat d'honoraires.");
      projectId = p.id;
    }
    await prisma.$transaction([
      prisma.contract.create({
        data: {
          projectId, amountHT: t.ht, vatRate: q.vatRate, signedAt: new Date(), notes: `Devis ${q.number}`,
          milestones: { create: DEFAULT_SCHEDULE.map((m, i) => ({ order: i + 1, label: m.label, percent: m.percent, step: m.step })) },
        },
      }),
      prisma.quote.update({ where: { id }, data: { projectId } }),
    ]);
    await audit(user, { entity: "Contrat", entityId: projectId, projectId, action: "création", summary: `Honoraires fixés à ${money(t.ht)} HT d'après le devis ${q.number}` });
    redirect(`/projets/${projectId}/finances`);
  });
}
