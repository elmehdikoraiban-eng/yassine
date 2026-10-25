import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { readStored } from "@/lib/storage";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return new NextResponse("Non connecté", { status: 401 });
  if (!can(user, "manageStakeholders")) return new NextResponse("Accès refusé", { status: 403 });
  const file = await prisma.stakeholderFile.findUnique({ where: { id } });
  if (!file) return new NextResponse("Introuvable", { status: 404 });
  const data = await readStored(file.storagePath);
  return new NextResponse(data, {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.size),
      "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(file.fileName),
      "Cache-Control": "private, no-store",
    },
  });
}

