import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";

// Compteur de la cloche, interrogé régulièrement par le navigateur.
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ unread: 0 }, { status: 401 });
  const [unread, latest] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.notification.findFirst({
      where: { userId: user.id, readAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, body: true, href: true },
    }),
  ]);
  return NextResponse.json({ unread, latest }, { headers: { "Cache-Control": "private, no-store" } });
}
