import Link from "next/link";
import { notFound } from "next/navigation";
import type { QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { date, money } from "@/lib/format";
import { quoteExpired, quoteTotals, QUOTE_STATUS_LABELS, QUOTE_STATUS_TONE } from "@/lib/quote";
import { Topbar, PageHead, Badge, Empty, Stat } from "@/components/ui";
import { Icon } from "@/components/icons";

const FILTERS: [string, string, QuoteStatus | null][] = [
  ["tous", "Tous", null],
  ["brouillons", "En préparation", "BROUILLON"],
  ["envoyes", "Envoyés", "ENVOYE"],
  ["acceptes", "Acceptés", "ACCEPTE"],
  ["refuses", "Refusés", "REFUSE"],
];

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ filtre?: string; q?: string }> }) {
  const user = await requireUser();
  if (!can(user, "seeFinance")) notFound();
  const { filtre = "tous", q } = await searchParams;
  const all = await prisma.quote.findMany({
    where: q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { object: { contains: q, mode: "insensitive" } }, { client: { name: { contains: q, mode: "insensitive" } } }] } : {},
    orderBy: { createdAt: "desc" },
    include: { lines: { select: { quantity: true, unitPrice: true } }, client: { select: { id: true, name: true } }, project: { select: { id: true, reference: true } } },
  });
  const rows = all.map((d) => ({ d, t: quoteTotals(d.lines, d.vatRate) }));
  const status = FILTERS.find((f) => f[0] === filtre)?.[2];
  const shown = status ? rows.filter((r) => r.d.status === status) : rows;
  const pending = rows.filter((r) => r.d.status === "ENVOYE");
  const year = new Date().getFullYear();
  const acceptedYear = rows.filter((r) => r.d.status === "ACCEPTE" && r.d.issueDate.getFullYear() === year);
  const decided = rows.filter((r) => r.d.status === "ACCEPTE" || r.d.status === "REFUSE").length;
  const rate = decided ? Math.round((rows.filter((r) => r.d.status === "ACCEPTE").length / decided) * 100) : null;

  return (
    <>
      <Topbar crumbs={[{ label: "Devis" }]} actions={can(user, "manageFinance") && <Link href="/devis/nouveau" className="btn btn-primary btn-sm"><Icon name="plus" /> Nouveau devis</Link>} />
      <div className="content">
        <PageHead title="Devis" subtitle="Propositions d'honoraires aux clients. Un devis accepté devient un projet avec son contrat et son échéancier." />
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <Stat label="En attente de réponse" value={money(pending.reduce((s, r) => s + r.t.total, 0))} sub={`${pending.length} devis envoyé(s)`} />
          <Stat label={`Accepté en ${year}`} value={money(acceptedYear.reduce((s, r) => s + r.t.total, 0))} sub={`${acceptedYear.length} devis`} />
          <Stat label="Taux d'acceptation" value={rate == null ? "—" : `${rate} %`} />
          <Stat label="En préparation" value={rows.filter((r) => r.d.status === "BROUILLON").length} />
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          {FILTERS.map(([k, label]) => (
            <Link key={k} href={`/devis?filtre=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="chip" style={filtre === k ? { background: "var(--bg-active)", color: "var(--text)" } : undefined}>{label}</Link>
          ))}
          <form style={{ marginLeft: "auto" }}>
            <input type="hidden" name="filtre" value={filtre} />
            <input name="q" defaultValue={q} placeholder="N°, objet, client" style={{ borderRadius: 999, width: 240 }} />
          </form>
        </div>
        <div className="card card-flush">
          {shown.length === 0 ? <Empty>Aucun devis.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>N°</th><th>Client</th><th>Objet</th><th>Date</th><th>Validité</th><th className="num">TTC</th><th>État</th></tr></thead>
                <tbody>
                  {shown.map(({ d, t }) => (
                    <tr key={d.id} className="clickable">
                      <td><Link href={`/devis/${d.id}`} className="link mono">{d.number}</Link></td>
                      <td>{d.client.name}{d.project && <div className="faint" style={{ fontSize: 12 }}>Projet {d.project.reference}</div>}</td>
                      <td>{d.object}</td>
                      <td className="nowrap">{date(d.issueDate)}</td>
                      <td className="nowrap">{date(d.validUntil)}</td>
                      <td className="num">{money(t.total)}</td>
                      <td>{quoteExpired(d) ? <Badge tone="warn">Expiré</Badge> : <Badge tone={QUOTE_STATUS_TONE[d.status]}>{QUOTE_STATUS_LABELS[d.status]}</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
