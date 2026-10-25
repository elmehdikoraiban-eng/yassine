import type { Metadata } from "next";
import "./globals.css";
import { getBrand } from "@/lib/brand";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand().catch(() => null);
  return {
    title: `${brand?.name ?? "Cabinet"} — Gestion intégrée`,
    description: "Clients, projets, documents, honoraires et factures du cabinet d'architecture.",
    icons: { icon: brand?.favicon ?? "/api/marque/favicon", apple: brand?.favicon ?? "/api/marque/favicon" },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
