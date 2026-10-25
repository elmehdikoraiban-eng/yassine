import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { num } from "@/lib/format";
import { Topbar, PageHead } from "@/components/ui";
import { QuoteForm } from "@/components/forms/quote-form";
import { createQuote } from "@/app/actions/quotes";

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await requireUser();
  if (!can(user, "manageFinance")) notFound();
  const { client } = await searchParams;
  const [clients, settings] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.settings.findFirst({ select: { vatRate: true } }),
  ]);
  return (
    <>
      <Topbar crumbs={[{ href: "/devis", label: "Devis" }, { label: "Nouveau" }]} />
      <div className="content" style={{ maxWidth: 980 }}>
        <PageHead title="Nouveau devis" subtitle="Le numéro est attribué automatiquement. Une fois accepté, le devis devient un projet avec son contrat d'honoraires." />
        {clients.length === 0 ? (
          <div className="notice">Créez d'abord une fiche client.</div>
        ) : (
          <QuoteForm clients={clients} defaultClient={client} vatRate={num(settings?.vatRate ?? 20)} action={createQuote} submit="Créer le devis" />
        )}
      </div>
    </>
  );
}
