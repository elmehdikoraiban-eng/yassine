import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Topbar, PageHead } from "@/components/ui";
import { QuoteForm } from "@/components/forms/quote-form";
import { updateQuote } from "@/app/actions/quotes";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "manageFinance")) notFound();
  const [q, clients] = await Promise.all([
    prisma.quote.findUnique({ where: { id }, include: { lines: { orderBy: { order: "asc" } } } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!q) notFound();
  if (q.status === "ACCEPTE" || q.status === "REFUSE") redirect(`/devis/${id}`);
  return (
    <>
      <Topbar crumbs={[{ href: "/devis", label: "Devis" }, { href: `/devis/${id}`, label: q.number }, { label: "Modifier" }]} />
      <div className="content" style={{ maxWidth: 980 }}>
        <PageHead title={`Modifier le devis ${q.number}`} />
        <QuoteForm quote={q} clients={clients} vatRate={20} action={updateQuote.bind(null, id)} submit="Enregistrer" />
      </div>
    </>
  );
}
