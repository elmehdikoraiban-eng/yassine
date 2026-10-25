import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { can, projectScope } from "@/lib/permissions";
import { readStored } from "@/lib/storage";
import { FOLDERS } from "@/lib/constants";

// Téléchargement d'une version de document, avec contrôle des droits.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return new NextResponse("Non connecté", { status: 401 });
  const v = await prisma.documentVersion.findUnique({ where: { id }, include: { document: true } });
  if (!v) return new NextResponse("Introuvable", { status: 404 });
  const allowed = await prisma.project.count({ where: { id: v.document.projectId, ...projectScope(user) } });
  const finance = FOLDERS.find((f) => f.code === v.document.folder)?.finance;
  if (!allowed || (finance && !can(user, "seeFinance"))) return new NextResponse("Accès refusé", { status: 403 });
  const data = await readStored(v.storagePath);
  const inline = new URL(req.url).searchParams.has("apercu");
  return new NextResponse(data, {
    headers: {
      "Content-Type": v.mime,
      "Content-Length": String(v.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(v.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
