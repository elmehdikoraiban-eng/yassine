"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function login(_: { error?: string } | undefined, fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "E-mail ou mot de passe incorrect." };
  }
  await createSession(user.id);
  await audit({ id: user.id, name: user.name, email: user.email, role: user.role }, {
    entity: "Utilisateur", entityId: user.id, action: "connexion", summary: `${user.name} s'est connecté`,
  });
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/connexion");
}

/** Premier lancement : crée le compte de l'architecte gérant, seulement si aucun compte n'existe. */
export async function setupFirstAdmin(_: { error?: string } | undefined, fd: FormData) {
  if ((await prisma.user.count()) > 0) return { error: "Le cabinet est déjà configuré : connectez-vous." };
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!name || !email || password.length < 8) return { error: "Nom, e-mail et mot de passe de 8 caractères minimum." };
  const user = await prisma.user.create({ data: { name, email, role: "GERANT", passwordHash: await bcrypt.hash(password, 10) } });
  await prisma.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  await createSession(user.id);
  await audit({ id: user.id, name: user.name, email: user.email, role: user.role }, {
    entity: "Utilisateur", entityId: user.id, action: "création", summary: `Compte gérant ${name} créé au premier lancement`,
  });
  redirect("/parametres");
}
