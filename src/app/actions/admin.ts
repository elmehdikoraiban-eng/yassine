"use server";

import { run } from "@/lib/action";
import bcrypt from "bcryptjs";
import { revalidatePath, revalidateTag } from "next/cache";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, requirePlatformAdmin } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { decimalOrNull, str } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/constants";
import { saveFile } from "@/lib/storage";
import { BRAND_MIME } from "@/lib/brand";

export async function createUser(fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageUsers");
    const name = str(fd, "name");
    const email = str(fd, "email")?.toLowerCase();
    const password = str(fd, "password");
    const role = str(fd, "role") as Role;
    if (!name || !email || !password || password.length < 8) throw new Error("Nom, e-mail et mot de passe (8 caractères minimum) obligatoires.");
    const u = await prisma.user.create({ data: { name, email, role, cabinetId: user.cabinetId, passwordHash: await bcrypt.hash(password, 10) } });
    await audit(user, { entity: "Utilisateur", entityId: u.id, action: "création", summary: `Compte ${name} créé (${ROLE_LABELS[role]})` });
    revalidatePath("/equipe");
  });
}

export async function updateUser(id: string, fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageUsers");
    const role = str(fd, "role") as Role;
    const active = fd.get("active") === "on";
    if (id === user.id && (!active || role !== "GERANT")) throw new Error("Vous ne pouvez pas retirer vos propres droits de gérant.");
    const password = str(fd, "password");
    const u = await prisma.user.update({
      where: { id },
      data: { role, active, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
    });
    await audit(user, {
      entity: "Utilisateur", entityId: id, action: "modification",
      summary: `${u.name} : ${ROLE_LABELS[role]}, ${active ? "actif" : "désactivé"}${password ? ", mot de passe réinitialisé" : ""}`,
    });
    revalidatePath("/equipe");
  });
}

export async function saveSettings(fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageUsers");
    const fields = ["name", "address", "city", "phone", "email", "ice", "ifiscal", "rc", "patente", "cnss", "rib"] as const;
    const data: Record<string, string | number> = {};
    for (const f of fields) data[f] = str(fd, f) ?? "";
    data.vatRate = decimalOrNull(fd, "vatRate") ?? 20;
    data.paymentDays = Number(str(fd, "paymentDays") ?? 30) || 30;
    await prisma.settings.upsert({ where: { cabinetId: user.cabinetId }, create: { cabinetId: user.cabinetId, ...data }, update: data });
    await audit(user, { entity: "Paramètres", entityId: "1", action: "modification", summary: "Informations du cabinet mises à jour" });
    revalidatePath("/parametres");
  });
}

/** Image de marque téléversée (logo ou favicon) : formats image courants, 1 Mo au plus. */
async function brandFile(fd: FormData, key: string) {
  const f = fd.get(key);
  if (!(f instanceof File) || f.size === 0) return null;
  if (!BRAND_MIME.includes(f.type)) throw new Error("Format d'image non accepté (PNG, JPG, SVG, WebP, GIF ou ICO).");
  if (f.size > 1024 * 1024) throw new Error("Image trop lourde : 1 Mo au maximum.");
  const stored = await saveFile("marque", f);
  return { path: stored.storagePath, mime: stored.mime };
}

export async function saveBrand(fd: FormData) {
  return run(async () => {
    const user = await requireUser();
    assertCan(user, "manageUsers");
    const appName = str(fd, "appName") ?? "";
    if (!appName) throw new Error("Le nom affiché est obligatoire.");
    const [logo, favicon] = await Promise.all([brandFile(fd, "logo"), brandFile(fd, "favicon")]);
    const data = {
      appName,
      showMark: fd.get("showMark") === "on",
      ...(logo ? { logoPath: logo.path, logoMime: logo.mime } : fd.get("removeLogo") === "on" ? { logoPath: null, logoMime: null } : {}),
      ...(favicon ? { faviconPath: favicon.path, faviconMime: favicon.mime } : fd.get("removeFavicon") === "on" ? { faviconPath: null, faviconMime: null } : {}),
      brandVersion: { increment: 1 },
    };
    await prisma.settings.upsert({ where: { cabinetId: user.cabinetId }, create: { cabinetId: user.cabinetId, ...data, brandVersion: 1 }, update: data });
    await audit(user, { entity: "Paramètres", entityId: "1", action: "modification", summary: "Nom, logo ou favicon modifiés" });
    revalidateTag("brand");
    revalidatePath("/", "layout");
  });
}


const ADMIN_PLANS = new Set(["TRIAL", "STARTER", "PRO", "BUSINESS"]);
const SUBSCRIPTION_STATES = new Set(["TRIAL", "ACTIVE", "PAST_DUE", "CANCELED"]);

function adminDate(fd: FormData, key: string, label: string) {
  const value = str(fd, key);
  if (!value) return null;
  const parsed = new Date(value + "T00:00:00.000Z");
  if (Number.isNaN(parsed.getTime())) throw new Error("La date " + label + " est invalide.");
  return parsed;
}

export async function updatePlatformCabinet(fd: FormData) {
  return run(async () => {
    const admin = await requirePlatformAdmin();
    const cabinetId = str(fd, "cabinetId");
    const status = str(fd, "status");
    const plan = str(fd, "plan");
    const subscriptionStatus = str(fd, "subscriptionStatus");
    if (!cabinetId || !status || !plan || !subscriptionStatus) throw new Error("Informations du cabinet incomplètes.");
    if (!new Set(["ACTIVE", "SUSPENDED"]).has(status)) throw new Error("Statut de cabinet invalide.");
    if (!ADMIN_PLANS.has(plan)) throw new Error("Formule invalide.");
    if (!SUBSCRIPTION_STATES.has(subscriptionStatus)) throw new Error("Statut d'abonnement invalide.");
    const existing = await prisma.cabinet.findUnique({ where: { id: cabinetId }, select: { id: true, name: true, status: true, plan: true, subscriptionStatus: true, trialEndsAt: true, subscriptionStartedAt: true, subscriptionRenewsAt: true, lastPaymentAt: true } });
    if (!existing) throw new Error("Cabinet introuvable.");

    const next = {
      status,
      plan,
      subscriptionStatus,
      trialEndsAt: adminDate(fd, "trialEndsAt", "de fin d'essai"),
      subscriptionStartedAt: adminDate(fd, "subscriptionStartedAt", "de début d'abonnement"),
      subscriptionRenewsAt: adminDate(fd, "subscriptionRenewsAt", "de renouvellement"),
      lastPaymentAt: adminDate(fd, "lastPaymentAt", "de paiement"),
    };
    await prisma.cabinet.update({ where: { id: cabinetId }, data: next });
    const changes = [
      existing.status !== status ? "statut " + existing.status + " → " + status : null,
      existing.plan !== plan ? "formule " + existing.plan + " → " + plan : null,
      existing.subscriptionStatus !== subscriptionStatus ? "abonnement " + existing.subscriptionStatus + " → " + subscriptionStatus : null,
      "dates d'essai, d'abonnement et de paiement enregistrées",
    ].filter(Boolean).join(" ; ");
    await prisma.platformAdminAction.create({ data: { adminId: admin.id, adminEmail: admin.email, cabinetId, action: "gestion_abonnement", summary: existing.name + " : " + changes } });
    revalidatePath("/admin");
  });
}

