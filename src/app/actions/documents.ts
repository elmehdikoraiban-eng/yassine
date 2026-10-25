"use server";

import { run } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { DocState, PlanStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth";
import { assertCan, can, ForbiddenError } from "@/lib/permissions";
import { assertProjectAccess } from "@/lib/access";
import { audit } from "@/lib/audit";
import { registerUploaded, saveFile, type Stored } from "@/lib/storage";
import { str } from "@/lib/format";
import { DOC_STATE_LABELS, FOLDERS, PLAN_STATUS_LABELS } from "@/lib/constants";

/** Indices de révision : A, B, … Z, AA, AB… */
export async function nextIndex(prev?: string | null) {
  if (!prev) return "A";
  const chars = prev.split("");
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] !== "Z") {
      chars[i] = String.fromCharCode(chars[i]!.charCodeAt(0) + 1);
      return chars.join("");
    }
    chars[i] = "A";
    i--;
  }
  return "A" + chars.join("");
}

const isFinanceFolder = (code: string) => FOLDERS.find((f) => f.code === code)?.finance ?? false;

async function loadDoc(user: SessionUser, id: string) {
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id },
    include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  await assertProjectAccess(user, doc.projectId);
  if (isFinanceFolder(doc.folder) && !can(user, "seeFinance")) throw new ForbiddenError();
  return doc;
}

/** Fichier du formulaire : envoyé avec le formulaire, ou déjà téléversé vers Vercel Blob. */
async function storedFrom(projectId: string, fd: FormData): Promise<Stored | null> {
  const blobUrl = str(fd, "blobUrl");
  if (blobUrl) return registerUploaded(projectId, blobUrl, str(fd, "blobName") ?? "fichier");
  const f = fd.get("file");
  return f instanceof File && f.size > 0 ? saveFile(projectId, f) : null;
}

export async function createDocument(projectId: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "uploadDocuments");
    await assertProjectAccess(user, projectId);
    const folder = str(fd, "folder") ?? "01_CLIENT";
    if (isFinanceFolder(folder) && !can(user, "seeFinance")) throw new ForbiddenError();
    const file = await storedFrom(projectId, fd);
    const isPlan = fd.get("isPlan") === "on" || folder === "07_PLANS_EXECUTION";
    if (!file && !isPlan) throw new Error("Choisissez un fichier.");
    const title = str(fd, "title") ?? file?.fileName ?? "Sans titre";
    const doc = await prisma.document.create({
      data: {
        projectId, folder, title, isPlan,
        planCode: isPlan ? str(fd, "planCode") : null,
        planStatus: isPlan ? (file ? "EN_COURS" : "A_PREPARER") : null,
      },
    });
    if (file) {
      await prisma.documentVersion.create({
        data: { documentId: doc.id, index: "A", ...file, authorId: user.id, comment: str(fd, "comment") },
      });
    }
    await audit(user, {
      entity: "Document", entityId: doc.id, projectId, action: file ? "dépôt" : "plan prévu",
      summary: file ? `« ${title} » déposé dans ${folder} (indice A)` : `Plan « ${title} » ajouté à la liste des plans à produire`,
    });
    revalidatePath(`/projets/${projectId}`, "layout");
  });
}

export async function addVersion(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "uploadDocuments");
    const doc = await loadDoc(user, id);
    const stored = await storedFrom(doc.projectId, fd);
    if (!stored) throw new Error("Choisissez un fichier.");
    const index = await nextIndex(doc.versions[0]?.index);
    // Une nouvelle version repasse le document en travail ; l'ancienne reste dans l'historique.
    const planStatus: PlanStatus | null = doc.isPlan
      ? doc.planStatus === "VALIDE" || doc.planStatus === "DIFFUSE" ? "REVISE" : doc.planStatus === "A_PREPARER" ? "EN_COURS" : doc.planStatus
      : null;
    await prisma.$transaction([
      prisma.documentVersion.create({
        data: { documentId: id, index, ...stored, authorId: user.id, comment: str(fd, "comment") },
      }),
      prisma.document.update({ where: { id }, data: { state: "TRAVAIL", planStatus } }),
    ]);
    await audit(user, { entity: "Document", entityId: id, projectId: doc.projectId, action: "nouvelle version", summary: `« ${doc.title} » : indice ${index}` });
    revalidatePath(`/documents/${id}`);
  });
}

export async function setDocState(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    const state = str(fd, "state") as DocState;
    assertCan(user, state === "VALIDE" ? "validateDocuments" : "changePlanStatus");
    const doc = await loadDoc(user, id);
    await prisma.document.update({
      where: { id },
      data: { state, ...(doc.isPlan && state === "VALIDE" ? { planStatus: "VALIDE" } : {}) },
    });
    await audit(user, { entity: "Document", entityId: id, projectId: doc.projectId, action: "état", summary: `« ${doc.title} » : ${DOC_STATE_LABELS[state]}` });
    revalidatePath(`/documents/${id}`);
  });
}

export async function setPlanStatus(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    const status = str(fd, "planStatus") as PlanStatus;
    assertCan(user, status === "VALIDE" ? "validateDocuments" : "changePlanStatus");
    const doc = await loadDoc(user, id);
    await prisma.document.update({
      where: { id },
      data: { planStatus: status, ...(status === "VALIDE" ? { state: "VALIDE" } : {}) },
    });
    await audit(user, { entity: "Document", entityId: id, projectId: doc.projectId, action: "état du plan", summary: `Plan « ${doc.title} » : ${PLAN_STATUS_LABELS[status]}` });
    revalidatePath(`/documents/${id}`);
    revalidatePath(`/projets/${doc.projectId}/plans`);
  });
}

export async function distribute(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "distributeDocuments");
    const doc = await loadDoc(user, id);
    const version = doc.versions[0];
    if (!version) throw new Error("Aucune version à diffuser.");
    const stakeholderId = str(fd, "stakeholderId");
    const recipient = str(fd, "recipient");
    if (!stakeholderId && !recipient) throw new Error("Indiquez un destinataire.");
    const d = await prisma.distribution.create({
      data: { documentId: id, versionId: version.id, stakeholderId, recipient, note: str(fd, "note"), userName: user.name },
      include: { stakeholder: true },
    });
    if (doc.isPlan) await prisma.document.update({ where: { id }, data: { planStatus: "DIFFUSE" } });
    await audit(user, {
      entity: "Document", entityId: id, projectId: doc.projectId, action: "diffusion",
      summary: `« ${doc.title} » indice ${version.index} transmis à ${d.stakeholder?.name ?? recipient}`,
    });
    revalidatePath(`/documents/${id}`);
  });
}

export async function moveDocument(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "changePlanStatus");
    const doc = await loadDoc(user, id);
    const folder = str(fd, "folder")!;
    if (isFinanceFolder(folder) && !can(user, "seeFinance")) throw new ForbiddenError();
    const title = str(fd, "title") ?? doc.title;
    await prisma.document.update({ where: { id }, data: { folder, title } });
    await audit(user, { entity: "Document", entityId: id, projectId: doc.projectId, action: "classement", summary: `« ${title} » classé dans ${folder}` });
    revalidatePath(`/documents/${id}`);
  });
}

export async function goToDocument(id: string) {
  redirect(`/documents/${id}`);
}
