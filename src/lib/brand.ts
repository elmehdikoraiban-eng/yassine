import "server-only";
import { prisma } from "./db";

export type Brand = { name: string; logo: string | null; favicon: string; showMark: boolean };

/** L'identité de marque est isolée par session cabinet et ne doit pas utiliser un cache partagé. */
export async function getBrand(): Promise<Brand> {
  const s = await prisma.settings.findFirst({
    select: { appName: true, logoPath: true, faviconPath: true, showMark: true, brandVersion: true },
  });
  const version = s?.brandVersion ?? 0;
  return {
    name: s?.appName || "Cabinet",
    logo: s?.logoPath ? `/api/marque/logo?v=${version}` : null,
    favicon: `/api/marque/favicon?v=${version}`,
    showMark: s?.showMark ?? true,
  };
}

export const BRAND_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
