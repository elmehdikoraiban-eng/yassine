// Données de démonstration : 4 comptes, 4 clients, 5 projets à différents stades.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

let currentCabinetId = "";
const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!currentCabinetId || model === "Cabinet") return query(args);
        const scoped = args as Record<string, unknown>;
        if (operation === "create" && scoped.data && typeof scoped.data === "object") scoped.data = { ...(scoped.data as Record<string, unknown>), cabinetId: currentCabinetId };
        if (operation === "createMany" && Array.isArray(scoped.data)) scoped.data = scoped.data.map((item) => ({ ...(item as Record<string, unknown>), cabinetId: currentCabinetId }));
        return query(scoped);
      },
    },
  },
});
const storage = path.resolve(process.env.STORAGE_DIR || "./storage");
const days = (n: number) => new Date(Date.now() + n * 86400000);

async function fakeFile(projectId: string, name: string, content: string) {
  const rel = path.join(projectId, `${randomUUID()}-${name}`);
  await mkdir(path.join(storage, projectId), { recursive: true });
  await writeFile(path.join(storage, rel), content);
  return { fileName: name, storagePath: rel, size: Buffer.byteLength(content), mime: "text/plain" };
}

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log("La base contient déjà des données : seed ignoré.");
    return;
  }
  const hash = await bcrypt.hash("cabinet2026", 10);
  const cabinet = await prisma.cabinet.create({ data: { name: "Cabinet d'architecture Benali", slug: "cabinet-demo", city: "Casablanca", contactEmail: "contact@cabinet.ma" } });
  currentCabinetId = cabinet.id;
  const [gerant, assistante, tech, collab] = await Promise.all([
    prisma.user.create({ data: { name: "Yassine Benali", email: "gerant@cabinet.ma", role: "GERANT", cabinetId: currentCabinetId, passwordHash: hash } }),
    prisma.user.create({ data: { name: "Salma Idrissi", email: "assistante@cabinet.ma", role: "ASSISTANTE", cabinetId: currentCabinetId, passwordHash: hash } }),
    prisma.user.create({ data: { name: "Karim Ouazzani", email: "technicien@cabinet.ma", role: "TECHNICIEN", cabinetId: currentCabinetId, passwordHash: hash } }),
    prisma.user.create({ data: { name: "Nadia Tazi", email: "collaborateur@cabinet.ma", role: "COLLABORATEUR", cabinetId: currentCabinetId, passwordHash: hash } }),
  ]);

  await prisma.settings.create({
    data: {
      cabinetId: currentCabinetId, name: "Cabinet d'architecture Benali", address: "12, rue Ibn Toufail", city: "Casablanca",
      phone: "+212 5 22 00 00 00", email: "contact@cabinet.ma", ice: "001234567000089", ifiscal: "12345678",
      rc: "123456", patente: "34567890", rib: "011 780 0000123456789012 34", vatRate: 20, paymentDays: 30,
    },
  });

  const clients = await Promise.all([
    prisma.client.create({ data: { type: "PHYSIQUE", name: "M. Hicham Alaoui", cin: "BE123456", phone: "+212 6 61 11 22 33", email: "h.alaoui@example.ma", address: "Lot Al Manar 45", city: "Rabat" } }),
    prisma.client.create({ data: { type: "MORALE", name: "Immobilière Atlas SARL", contact: "Mme Leila Fassi", ice: "002345678000012", rc: "98765", phone: "+212 5 22 33 44 55", email: "contact@atlas-immo.ma", address: "Bd Zerktouni 210", city: "Casablanca" } }),
    prisma.client.create({ data: { type: "PHYSIQUE", name: "Mme Samira Bennani", phone: "+212 6 70 98 76 54", city: "Marrakech" } }),
    prisma.client.create({ data: { type: "MORALE", name: "Commune de Bouskoura", contact: "Service de l'urbanisme", ice: "003456789000034", city: "Bouskoura" } }),
  ]);

  const stakeholders = await Promise.all([
    prisma.stakeholder.create({ data: { kind: "BET", name: "BET Structures Maghreb", contact: "Ing. Rachid Amrani", phone: "+212 5 22 11 11 11", email: "bet@structures.ma" } }),
    prisma.stakeholder.create({ data: { kind: "BET", name: "Fluides Ingénierie", contact: "Ing. Sara Lahlou", email: "contact@fluides.ma" } }),
    prisma.stakeholder.create({ data: { kind: "ENTREPRISE", name: "Entreprise Bâtir Plus", contact: "M. Omar Kettani", phone: "+212 6 62 00 00 00" } }),
    prisma.stakeholder.create({ data: { kind: "BUREAU_CONTROLE", name: "Veritas Contrôle Maroc", email: "casa@controle.ma" } }),
    prisma.stakeholder.create({ data: { kind: "TOPOGRAPHE", name: "Topo Atlas", phone: "+212 6 63 00 00 00" } }),
  ]);

  const schedule = [
    { label: "Signature du contrat", percent: 20, step: 4 },
    { label: "Conception", percent: 20, step: 7 },
    { label: "Autorisation", percent: 20, step: 11 },
    { label: "Plans d'exécution", percent: 20, step: 12 },
    { label: "Fin des travaux", percent: 10, step: 17 },
    { label: "Permis d'habiter", percent: 10, step: 19 },
  ];

  const specs = [
    { name: "Villa R+1 Al Manar", client: 0, city: "Rabat", nature: "Villa", step: 15, ht: 180000, tf: "TF 12345/R", members: [tech.id], st: [0, 2, 3], st0: 300 },
    { name: "Résidence Les Jardins, 24 logements", client: 1, city: "Casablanca", nature: "Immeuble R+4", step: 9, ht: 650000, tf: "TF 7788/C", members: [tech.id, collab.id], st: [0, 1, 4], st0: 120 },
    { name: "Riad Bennani, réhabilitation", client: 2, city: "Marrakech", nature: "Réhabilitation", step: 7, ht: 95000, tf: null, members: [tech.id], st: [4], st0: 60 },
    { name: "Centre culturel communal", client: 3, city: "Bouskoura", nature: "Équipement public", step: 3, ht: 0, tf: null, members: [], st: [], st0: 20 },
    { name: "Extension villa Hay Riad", client: 0, city: "Rabat", nature: "Extension", step: 19, ht: 60000, tf: "TF 4521/R", members: [], st: [2], st0: 420 },
  ];

  let pCount = 0;
  let fCount = 0;
  for (const s of specs) {
    pCount++;
    const ref = `P-2026-${String(pCount).padStart(3, "0")}`;
    const project = await prisma.project.create({
      data: {
        reference: ref, name: s.name, clientId: clients[s.client]!.id, city: s.city, nature: s.nature, step: s.step,
        landTitle: s.tf, location: "Voir plan de situation", startDate: days(-s.st0),
        surfaceTerrain: 400 + pCount * 150, surfaceConstruite: 300 + pCount * 210,
        programme: "Programme défini avec le client lors de la première réunion.",
        members: { create: [gerant.id, assistante.id, ...s.members].map((userId) => ({ userId, cabinet: { connect: { id: currentCabinetId } } })) },
        stakeholders: { create: s.st.map((i) => ({ stakeholderId: stakeholders[i]!.id, cabinet: { connect: { id: currentCabinetId } }, mission: stakeholders[i]!.kind === "BET" ? "Études techniques" : undefined })) },
      },
    });
    await prisma.auditLog.create({ data: { userId: assistante.id, entity: "Projet", entityId: project.id, projectId: project.id, action: "création", summary: `Dossier ${ref} « ${s.name} » ouvert`, createdAt: days(-s.st0) } });
    for (let n = 2; n <= s.step; n++) {
      await prisma.stepChange.create({ data: { projectId: project.id, fromStep: n - 1, toStep: n, userName: gerant.name, createdAt: days(-s.st0 + ((n - 1) * s.st0) / s.step) } });
    }

    // Documents
    const docs = [
      { folder: "01_CLIENT", title: "CIN et coordonnées du client", versions: 1 },
      { folder: "03_FONCIER", title: "Certificat de propriété", versions: 1 },
      { folder: "05_CONCEPTION", title: "Esquisse — variante retenue", versions: s.step >= 7 ? 3 : 1 },
    ];
    if (s.step >= 8) docs.push({ folder: "06_AUTORISATION", title: "Dossier de demande d'autorisation", versions: 2 });
    for (const d of docs) {
      const doc = await prisma.document.create({ data: { projectId: project.id, folder: d.folder, title: d.title, state: d.versions > 1 && s.step > 8 ? "VALIDE" : "TRAVAIL" } });
      for (let v = 0; v < d.versions; v++) {
        const idx = String.fromCharCode(65 + v);
        await prisma.documentVersion.create({
          data: { documentId: doc.id, index: idx, authorId: v % 2 ? gerant.id : tech.id, comment: v ? "Reprise suite aux remarques" : "Première émission", ...(await fakeFile(project.id, `${d.title.replace(/\W+/g, "_")}_${idx}.txt`, `${d.title} — indice ${idx}`)) },
        });
      }
    }
    if (s.step >= 12) {
      const plans = [
        ["EXE-ARC-101", "Plan de fondations", "DIFFUSE"],
        ["EXE-ARC-102", "Plan du rez-de-chaussée", "VALIDE"],
        ["EXE-ARC-103", "Plan de l'étage", "A_VERIFIER"],
        ["EXE-ARC-201", "Coupes et façades", "EN_COURS"],
        ["EXE-ARC-301", "Détails menuiseries", "A_PREPARER"],
      ] as const;
      for (const [code, title, status] of plans) {
        const doc = await prisma.document.create({ data: { projectId: project.id, folder: "07_PLANS_EXECUTION", title, isPlan: true, planCode: code, planStatus: status, state: status === "VALIDE" || status === "DIFFUSE" ? "VALIDE" : "TRAVAIL" } });
        if (status !== "A_PREPARER") {
          const v = await prisma.documentVersion.create({ data: { documentId: doc.id, index: "A", authorId: tech.id, ...(await fakeFile(project.id, `${code}_A.txt`, `${code} ${title}`)) } });
          if (status === "DIFFUSE" && s.st.length) {
            await prisma.distribution.create({ data: { documentId: doc.id, versionId: v.id, stakeholderId: stakeholders[2]!.id, userName: tech.name, note: "Envoi par e-mail" } });
          }
        }
      }
    }

    // Honoraires, factures, règlements
    if (s.ht > 0) {
      const contract = await prisma.contract.create({
        data: { projectId: project.id, amountHT: s.ht, vatRate: 20, signedAt: days(-s.st0 + 10), milestones: { create: schedule.map((m, i) => ({ order: i + 1, ...m, cabinet: { connect: { id: currentCabinetId } } })) } },
        include: { milestones: { orderBy: { order: "asc" } } },
      });
      for (const m of contract.milestones) {
        if (m.step! > s.step) continue;
        // La dernière échéance atteinte de la villa reste à facturer, pour la démonstration.
        if (pCount === 1 && m.step === 12) continue;
        fCount++;
        const amountHT = (s.ht * Number(m.percent)) / 100;
        const ttc = amountHT * 1.2;
        const issued = days(-s.st0 + ((m.step! - 1) * s.st0) / s.step + 5);
        const number = `FA-2026-${String(fCount).padStart(4, "0")}`;
        const inv = await prisma.invoice.create({
          data: { projectId: project.id, milestoneId: m.id, number, object: `Honoraires — ${m.label} (${Number(m.percent)} %)`, amountHT, vatRate: 20, status: "EMISE", issueDate: issued, dueDate: new Date(issued.getTime() + 30 * 86400000) },
        });
        const isLast = m.step === Math.max(...contract.milestones.filter((x) => x.step! <= s.step).map((x) => x.step!));
        if (!isLast) {
          await prisma.payment.create({ data: { invoiceId: inv.id, date: new Date(issued.getTime() + 20 * 86400000), amount: ttc, method: "VIREMENT", reference: `VIR-${fCount}${pCount}0`, userName: assistante.name } });
        } else if (pCount === 2) {
          await prisma.payment.create({ data: { invoiceId: inv.id, date: days(-5), amount: Math.round(ttc / 2), method: "CHEQUE", reference: "CHQ 445566", userName: assistante.name } });
        }
        await prisma.auditLog.create({ data: { userId: assistante.id, entity: "Facture", entityId: inv.id, projectId: project.id, action: "émission", summary: `Facture ${number} émise`, createdAt: issued } });
      }
    }
  }
  await prisma.counter.createMany({ data: [{ cabinetId: currentCabinetId, key: "P-2026", value: pCount }, { cabinetId: currentCabinetId, key: "FA-2026", value: fCount }] });
  console.log("Données de démonstration créées. Connexion : gerant@cabinet.ma / cabinet2026");
}

main().finally(() => prisma.$disconnect());
