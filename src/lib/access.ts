import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { SessionUser } from "./auth";
import { projectScope } from "./permissions";

/** Vérifie que l'utilisateur a accès au projet (affectation pour les profils restreints). */
export async function assertProjectAccess(user: SessionUser, projectId: string) {
  const p = await prisma.project.findFirst({ where: { id: projectId, ...projectScope(user) }, select: { id: true } });
  if (!p) notFound();
}

/** Prochain numéro d'une séquence annuelle (projets, factures), sans trou ni doublon. */
export async function nextNumber(prefix: string, year = new Date().getFullYear(), pad = 3, db: Prisma.TransactionClient = prisma) {
  const key = `${prefix}-${year}`;
  const c = await db.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${key}-${String(c.value).padStart(pad, "0")}`;
}
