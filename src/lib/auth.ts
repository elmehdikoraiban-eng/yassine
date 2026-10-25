import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { prisma } from "./db";

const COOKIE = "cabinet_session";
const secret = () => {
  const s = process.env.AUTH_SECRET;
  // En production, jamais de secret par défaut : les sessions seraient falsifiables.
  if (!s && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET manquant.");
  return new TextEncoder().encode(s || "dev-secret-a-remplacer");
};

export type SessionUser = { id: string; name: string; email: string; role: Role };

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
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

/** Une seule lecture de la session par requête, même si layouts et pages l'appellent tous. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = await prisma.user.findUnique({
      where: { id: String(payload.sub) },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
    if (!user || !user.active) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  } catch {
    return null;
  }
});

/** Renvoie l'utilisateur connecté ou redirige vers la page de connexion. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/connexion");
  return user;
}
