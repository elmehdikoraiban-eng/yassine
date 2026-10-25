import "server-only";
import type { Role } from "@prisma/client";
import { prisma } from "./db";
import type { SessionUser } from "./auth";

type Notice = { title: string; body?: string | null; href?: string };

/** Notification interne aux utilisateurs donnés (l'auteur de l'action n'est pas notifié). */
export async function notify(actor: SessionUser, userIds: Iterable<string>, n: Notice) {
  const ids = [...new Set(userIds)].filter((id) => id !== actor.id);
  if (ids.length === 0) return;
  await prisma.notification.createMany({
    data: ids.map((userId) => ({ userId, title: n.title, body: n.body || null, href: n.href, actorName: actor.name })),
  });
}

/** Notifie tous les comptes actifs ayant l'un des rôles donnés. */
export async function notifyRoles(actor: SessionUser, roles: Role[], n: Notice) {
  const users = await prisma.user.findMany({ where: { active: true, role: { in: roles } }, select: { id: true } });
  await notify(actor, users.map((u) => u.id), n);
}
