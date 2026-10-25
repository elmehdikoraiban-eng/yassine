import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readStored } from "@/lib/storage";

// Logo et favicon du cabinet : publics, car affichés aussi sur la page de connexion.
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind !== "logo" && kind !== "favicon") return new NextResponse("Introuvable", { status: 404 });
  const s = await prisma.settings.findUnique({ where: { id: 1 }, select: { appName: true, logoPath: true, faviconPath: true, logoMime: true, faviconMime: true } });
  const versioned = new URL(req.url).searchParams.has("v");
  const cache = versioned ? "public, max-age=31536000, immutable" : "public, max-age=300";
  const path = kind === "logo" ? s?.logoPath : s?.faviconPath;
  if (path) {
    const mime = (kind === "logo" ? s?.logoMime : s?.faviconMime) || "image/png";
    return new NextResponse(await readStored(path), {
      headers: { "Content-Type": mime, "Cache-Control": cache, "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox", "X-Content-Type-Options": "nosniff" },
    });
  }
  if (kind === "logo") return new NextResponse("Aucun logo", { status: 404 });
  // Favicon par défaut : pastille noire avec l'initiale du cabinet.
  const letter = ((s?.appName || "Cabinet").trim()[0] || "C").toUpperCase().replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#0d0d0d"/><text x="32" y="43" font-family="system-ui,-apple-system,Segoe UI,Arial,sans-serif" font-size="30" font-weight="600" fill="#fff" text-anchor="middle">${letter}</text></svg>`;
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": cache } });
}
