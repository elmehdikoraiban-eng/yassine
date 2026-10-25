import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { prisma } from "./db";

const COOKIE = "cabinet_session";
const secret = () => {
  const value = process.env.AUTH_SECRET;
  if (!value && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET manquant.");
  return new TextEncoder().encode(value || "dev-secret-a-remplacer");
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  cabinetId: string;
  isPlatformAdmin: boolean;
};

export function isPlatformAdminEmail(email: string) {
  return new Set((process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean)).has(email.toLowerCase());
}

export async function createSession(user: Pick<SessionUser, "id" | "email" | "cabinetId">) {
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    cabinetId: user.cabinetId,
    platformAdmin: isPlatformAdminEmail(user.email),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = await prisma.user.findUnique({
      where: { id: String(payload.sub) },
      select: { id: true, name: true, email: true, role: true, active: true, cabinetId: true, cabinet: { select: { status: true } } },
    });
    if (!user || !user.active || !user.cabinetId) return null;
    const isPlatformAdmin = isPlatformAdminEmail(user.email);
    if (user.cabinet.status !== "ACTIVE" && !isPlatformAdmin) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      cabinetId: user.cabinetId,
      isPlatformAdmin,
    };
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/connexion");
  return user;
}

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/");
  return user;
}
