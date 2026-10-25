import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { can, projectScope } from "@/lib/permissions";

// Délivre un jeton de téléversement direct vers Vercel Blob (fichiers > 4,5 Mo, plans).
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getUser();
        if (!user || !can(user, "uploadDocuments")) throw new Error("Non autorisé");
        const projectId = clientPayload ?? "";
        const ok = await prisma.project.count({ where: { id: projectId, ...projectScope(user) } });
        if (!ok || !pathname.startsWith(`${projectId}/`)) throw new Error("Projet inaccessible");
        return { addRandomSuffix: true, maximumSizeInBytes: 500 * 1024 * 1024 };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
