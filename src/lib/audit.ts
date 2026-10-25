import { prisma } from "./db";
import type { SessionUser } from "./auth";

/** §28 — Journal de traçabilité : qui, quand, quoi. */
export async function audit(
  user: SessionUser | null,
  entry: { entity: string; entityId: string; action: string; summary: string; projectId?: string | null },
) {
  await prisma.auditLog.create({
    data: { userId: user?.id ?? null, projectId: entry.projectId ?? null, ...entry },
  });
}
