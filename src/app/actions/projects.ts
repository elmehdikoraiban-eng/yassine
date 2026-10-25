"use server";

import { run } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProjectStatus, StakeholderKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { assertProjectAccess, nextNumber } from "@/lib/access";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { decimalOrNull, str } from "@/lib/format";
import { PROJECT_STATUS_LABELS, STAKEHOLDER_KIND_LABELS, stepLabel } from "@/lib/constants";
import { registerUploaded, saveFile } from "@/lib/storage";

const projectData = (fd: FormData) => ({
  name: str(fd, "name") ?? "",
  clientId: str(fd, "clientId") ?? "",
  location: str(fd, "location"),
  city: str(fd, "city"),
  nature: str(fd, "nature"),
  programme: str(fd, "programme"),
  landTitle: str(fd, "landTitle"),
  technicianObjective: str(fd, "technicianObjective"),
  surfaceTerrain: decimalOrNull(fd, "surfaceTerrain"),
  surfaceConstruite: decimalOrNull(fd, "surfaceConstruite"),
});

export async function createProject(fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageProjects");
    const data = projectData(fd);
    if (!data.name || !data.clientId) throw new Error("Le nom du projet et le client sont obligatoires.");
    const reference = await nextNumber("P");
    const memberIds = fd.getAll("members").map(String);
    const instructions = str(fd, "instructions");
    const project = await prisma.project.create({
      data: {
        ...data,
        reference,
        members: { create: [...new Set([user.id, ...memberIds])].map((userId) => ({ userId })) },
      },
      include: { client: { select: { name: true } } },
    });
    const managers = await prisma.user.findMany({ where: { active: true, role: "GERANT" }, select: { id: true } });
    await Promise.all([
      audit(user, { entity: "Projet", entityId: project.id, projectId: project.id, action: "création", summary: `Dossier ${reference} « ${project.name} » ouvert` }),
      notify(user, memberIds, {
        title: `Nouveau projet : ${project.name}`,
        body: [`Vous êtes affecté au dossier ${reference} (client ${project.client.name}).`, instructions && `Consigne : ${instructions}`].filter(Boolean).join("\n"),
        href: `/projets/${project.id}`,
      }),
      notify(user, managers.map((m) => m.id).filter((id) => !memberIds.includes(id)), {
        title: `Dossier ouvert : ${project.name}`,
        body: `${reference} pour ${project.client.name}.${instructions ? `\nConsigne : ${instructions}` : ""}`,
        href: `/projets/${project.id}`,
      }),
    ]);
    redirect(`/projets/${project.id}`);
  });
}

export async function updateProject(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageProjects");
    const data = projectData(fd);
    if (!data.name || !data.clientId) throw new Error("Le nom du projet et le client sont obligatoires.");
    await prisma.project.update({ where: { id }, data });
    await audit(user, { entity: "Projet", entityId: id, projectId: id, action: "modification", summary: "Informations du projet modifiées" });
    redirect(`/projets/${id}`);
  });
}

export async function changeStep(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageProjects");
    const to = Number(fd.get("step"));
    if (!Number.isInteger(to) || to < 1 || to > 20) throw new Error("Étape invalide.");
    const comment = str(fd, "comment");
    const p = await prisma.project.findUniqueOrThrow({ where: { id } });
    if (p.step === to) return;
    await prisma.$transaction([
      prisma.project.update({ where: { id }, data: { step: to } }),
      prisma.stepChange.create({ data: { projectId: id, fromStep: p.step, toStep: to, userName: user.name, comment } }),
    ]);
    await audit(user, {
      entity: "Projet", entityId: id, projectId: id, action: "changement d'étape",
      summary: `Étape ${p.step} → ${to} : ${stepLabel(to)}${comment ? ` (${comment})` : ""}`,
    });
    revalidatePath(`/projets/${id}`);
  });
}

export async function setProjectStatus(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageProjects");
    const status = str(fd, "status") as ProjectStatus;
    await prisma.project.update({ where: { id }, data: { status } });
    await audit(user, { entity: "Projet", entityId: id, projectId: id, action: "statut", summary: `Projet passé à « ${PROJECT_STATUS_LABELS[status]} »` });
    revalidatePath(`/projets/${id}`);
  });
}

export async function setMembers(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageProjects");
    const ids = [...new Set(fd.getAll("members").map(String))];
    const before = new Set((await prisma.projectMember.findMany({ where: { projectId: id }, select: { userId: true } })).map((m) => m.userId));
    await prisma.$transaction([
      prisma.projectMember.deleteMany({ where: { projectId: id } }),
      prisma.projectMember.createMany({ data: ids.map((userId) => ({ projectId: id, userId })) }),
    ]);
    const names = (await prisma.user.findMany({ where: { id: { in: ids } }, select: { name: true } })).map((u) => u.name);
    await audit(user, { entity: "Projet", entityId: id, projectId: id, action: "équipe", summary: `Équipe : ${names.join(", ") || "aucune"}` });
    const added = ids.filter((uid) => !before.has(uid));
    if (added.length) {
      const p = await prisma.project.findUniqueOrThrow({ where: { id }, select: { name: true, reference: true } });
      await notify(user, added, { title: `Affecté au projet : ${p.name}`, body: `Vous rejoignez l'équipe du dossier ${p.reference}.`, href: `/projets/${id}` });
    }
    revalidatePath(`/projets/${id}`);
  });
}

/** Consigne envoyée à l'équipe du projet (notification dans l'application). */
export async function sendInstruction(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    await assertProjectAccess(user, id);
    const message = str(fd, "message");
    if (!message) throw new Error("Écrivez la consigne à transmettre.");
    const p = await prisma.project.findUniqueOrThrow({ where: { id }, select: { name: true, members: { select: { userId: true } } } });
    const team = new Set(p.members.map((m) => m.userId));
    const to = fd.getAll("to").map(String).filter((uid) => team.has(uid));
    if (to.length === 0) throw new Error("Choisissez au moins un destinataire.");
    await notify(user, to, { title: `Consigne · ${p.name}`, body: message, href: `/projets/${id}` });
    await audit(user, { entity: "Projet", entityId: id, projectId: id, action: "consigne", summary: `Consigne envoyée à ${to.length} personne(s) : ${message.slice(0, 120)}` });
    revalidatePath(`/projets/${id}`);
  });
}

// ——— Intervenants (BET, entreprise, bureau de contrôle…) ———

const stakeholderData = (fd: FormData) => ({
  kind: (str(fd, "kind") ?? "AUTRE") as StakeholderKind,
  name: str(fd, "name") ?? "",
  contact: str(fd, "contact"),
  phone: str(fd, "phone"),
  email: str(fd, "email"),
});

export async function createStakeholder(fd: FormData) {
  const user = await requireUser();
  assertCan(user, "manageStakeholders");
  const data = stakeholderData(fd);
  if (!data.name) throw new Error("Le nom est obligatoire.");
  const s = await prisma.stakeholder.create({ data });
  await audit(user, { entity: "Intervenant", entityId: s.id, action: "création", summary: `${STAKEHOLDER_KIND_LABELS[s.kind]} « ${s.name} » ajouté` });
  revalidatePath("/intervenants");
  return s.id;
}

export async function linkStakeholder(projectId: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageStakeholders");
    await assertProjectAccess(user, projectId);
    let stakeholderId = str(fd, "stakeholderId");
    if (!stakeholderId || stakeholderId === "__new") stakeholderId = await createStakeholder(fd);
    const mission = str(fd, "mission");
    await prisma.projectStakeholder.upsert({
      where: { projectId_stakeholderId: { projectId, stakeholderId } },
      create: { projectId, stakeholderId, mission },
      update: { mission },
    });
    const s = await prisma.stakeholder.findUniqueOrThrow({ where: { id: stakeholderId } });
    await audit(user, { entity: "Projet", entityId: projectId, projectId, action: "intervenant", summary: `${s.name} associé au projet${mission ? ` (${mission})` : ""}` });
    revalidatePath(`/projets/${projectId}/intervenants`);
  });
}

export async function unlinkStakeholder(projectId: string, stakeholderId: string) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageStakeholders");
    await assertProjectAccess(user, projectId);
    const s = await prisma.stakeholder.findUniqueOrThrow({ where: { id: stakeholderId } });
    await prisma.projectStakeholder.delete({ where: { projectId_stakeholderId: { projectId, stakeholderId } } });
    await audit(user, { entity: "Projet", entityId: projectId, projectId, action: "intervenant", summary: `${s.name} retiré du projet` });
    revalidatePath(`/projets/${projectId}/intervenants`);
  });
}

export async function uploadStakeholderFile(stakeholderId: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageStakeholders");
    const stakeholder = await prisma.stakeholder.findUniqueOrThrow({ where: { id: stakeholderId }, select: { id: true, name: true } });
    const file = fd.get("file");
    const blobUrl = str(fd, "blobUrl");
    if (!blobUrl && (!(file instanceof File) || file.size === 0)) throw new Error("Choisissez un fichier.");
    if (file instanceof File && file.size > 25 * 1024 * 1024) throw new Error("Le fichier ne peut pas dépasser 25 Mo.");
    const scope = "intervenants/" + stakeholderId;
    const stored = blobUrl ? await registerUploaded(scope, blobUrl, str(fd, "blobName") ?? "fichier") : await saveFile(scope, file as File);
    if (stored.size > 25 * 1024 * 1024) throw new Error("Le fichier ne peut pas dépasser 25 Mo.");
    const row = await prisma.stakeholderFile.create({ data: { cabinetId: user.cabinetId, stakeholderId, authorId: user.id, ...stored } });
    await audit(user, { entity: "Fichier intervenant", entityId: row.id, action: "dépôt", summary: "Fichier ajouté au Drive de " + stakeholder.name });
    revalidatePath("/intervenants/" + stakeholderId);
  });
}

export async function createStakeholderForm(fd: FormData) {
  return run(async () => {
    await createStakeholder(fd);
  });
}

