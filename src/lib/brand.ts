import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "./db";

export type Brand = { name: string; logo: string | null; favicon: string; showMark: boolean };

/** Identité affichée (nom, logo, favicon), mise en cache jusqu'à la prochaine modification des paramètres. */
export const getBrand = unstable_cache(
  async (): Promise<Brand> => {
    const s = await prisma.settings.findUnique({
      where: { id: 1 },
      select: { appName: true, logoPath: true, faviconPath: true, showMark: true, brandVersion: true },
    });
    const v = s?.brandVersion ?? 0;
    return {
      name: s?.appName || "Cabinet",
      logo: s?.logoPath ? `/api/marque/logo?v=${v}` : null,
      favicon: `/api/marque/favicon?v=${v}`,
      showMark: s?.showMark ?? true,
    };
  },
  ["brand"],
  { tags: ["brand"] },
);

export const BRAND_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
