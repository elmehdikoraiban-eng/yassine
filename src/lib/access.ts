import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "./db";
import type { SessionUser } from "./auth";
import { projectScope } from "./permissions";

export async function assertProjectAccess(user: SessionUser, projectId: string) {
  const p = await prisma.project.findFirst({ where: { id: projectId, ...projectScope(user) }, select: { id: true } });
  if (!p) notFound();
}

type NumberingClient = Pick<typeof prisma, "counter">;

export async function nextNumber(prefix: string, year = new Date().getFullYear(), pad = 3, db: NumberingClient = prisma) {
  const cabinetId = (await headers()).get("x-cabinet-id");
  if (!cabinetId) throw new Error("Session de cabinet manquante.");
  const key = `${prefix}-${year}`;
  const c = await db.counter.upsert({
    where: { cabinetId_key: { cabinetId, key } },
    create: { cabinetId, key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${key}-${String(c.value).padStart(pad, "0")}`;
}
