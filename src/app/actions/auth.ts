"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";

export async function login(_: { error?: string } | undefined, fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "E-mail ou mot de passe incorrect." };
  }
  await prisma.$executeRaw`UPDATE "User" SET "lastLoginAt" = NOW() WHERE "id" = ${user.id}`;
  await createSession({ id: user.id, email: user.email, cabinetId: user.cabinetId });
  redirect("/");
}

export async function registerCabinet(_: { error?: string } | undefined, fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  const cabinetName = String(fd.get("cabinetName") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const city = String(fd.get("city") ?? "").trim();
  const phone = String(fd.get("phone") ?? "").trim();

  if (!name || !cabinetName || !email || password.length < 8) {
    return { error: "Renseignez votre nom, votre cabinet, votre e-mail et un mot de passe de 8 caractères minimum." };
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: "Cet e-mail possède déjà un compte. Connectez-vous." };

  const passwordHash = await bcrypt.hash(password, 12);
  const slugBase = cabinetName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "cabinet";
  const slug = `${slugBase}-${crypto.randomUUID().slice(0, 8)}`;

  try {
    const cabinet = await prisma.cabinet.create({
      data: {
        name: cabinetName,
        slug,
        city: city || null,
        phone: phone || null,
        contactEmail: email,
        plan: "FREE",
        subscriptionStatus: "FREE",
        users: { create: { name, email, role: "GERANT", passwordHash, lastLoginAt: new Date() } },
        settings: { create: { name: cabinetName, city, phone, email } },
      },
      include: { users: { where: { email }, select: { id: true, email: true } } },
    });
    const owner = cabinet.users[0];
    if (!owner) return { error: "La création du compte a échoué. Réessayez." };
    await createSession({ id: owner.id, email: owner.email, cabinetId: cabinet.id });
  } catch {
    return { error: "Impossible de créer ce cabinet. Vérifiez si l’e-mail est déjà utilisé puis réessayez." };
  }

  redirect("/parametres");
}

export async function logout() {
  await destroySession();
  redirect("/connexion");
}

