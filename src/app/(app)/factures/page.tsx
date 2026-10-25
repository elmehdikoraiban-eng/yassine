import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { date, money } from "@/lib/format";
import { invoiceStatus, invoiceTotals, INVOICE_STATUS_LABELS, INVOICE_STATUS_TONE, type DisplayStatus } from "@/lib/finance";
import { Topbar, PageHead, Badge, Empty, Stat } from "@/components/ui";

const FILTERS: [string, string, DisplayStatus[] | null][] = [
  ["tous", "Toutes", null],
  ["brouillons", "En préparation", ["BROUILLON"]],
  ["impayees", "Impayées", ["EMISE", "PARTIELLE", "EN_RETARD"]],
  ["retard", "En retard", ["EN_RETARD"]],
  ["reglees", "Réglées", ["REGLEE"]],
  ["annulees", "Annulées", ["ANNULEE"]],
];

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ filtre?: string; q?: string }> }) {
  const user = await requireUser();
  if (!can(user, "seeFinance")) notFound();
  const { filtre = "tous", q } = await searchParams;
  const all = await prisma.invoice.findMany({
    where: q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { object: { contains: q, mode: "insensitive" } }, { project: { name: { contains: q, mode: "insensitive" } } }, { project: { client: { name: { contains: q, mode: "insensitive" } } } }] } : {},
    orderBy: [{ issueDate: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
    include: { payments: true, project: { select: { id: true, name: true, reference: true, client: { select: { name: true } } } } },
  });
  const rows = all.map((i) => ({ i, t: invoiceTotals(i), s: invoiceStatus(i) }));
  const allowed = FILTERS.find((f) => f[0] === filtre)?.[2];
  const shown = allowed ? rows.filter((r) => allowed.includes(r.s)) : rows;
  const unpaid = rows.filter((r) => ["EMISE", "PARTIELLE", "EN_RETARD"].includes(r.s));
  const late = rows.filter((r) => r.s === "EN_RETARD");
  const year = new Date().getFullYear();
  const collectedYear = rows.flatMap((r) => r.i.payments).filter((p) => p.date.getFullYear() === year).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <>
      <Topbar crumbs={[{ label: "Factures" }]} />
      <div className="content">
        <PageHead title="Factures et règlements" subtitle="Numérotation continue à l'émission ; une facture émise ne se supprime pas, elle s'annule avec un motif." />
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <Stat label="Reste à encaisser" value={money(unpaid.reduce((s, r) => s + r.t.due, 0))} sub={`${unpaid.length} facture(s)`} />
          <Stat label="En retard" value={money(late.reduce((s, r) => s + r.t.due, 0))} sub={`${late.length} facture(s)`} />
          <Stat label={`Encaissé en ${year}`} value={money(collectedYear)} />
          <Stat label="En préparation" value={rows.filter((r) => r.s === "BROUILLON").length} />
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          {FILTERS.map(([k, label]) => (
            <Link key={k} href={`/factures?filtre=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="chip" style={filtre === k ? { background: "var(--bg-active)", color: "var(--text)" } : undefined}>{label}</Link>
          ))}
          <form style={{ marginLeft: "auto" }}>
            <input type="hidden" name="filtre" value={filtre} />
            <input name="q" defaultValue={q} placeholder="N°, objet, projet, client" style={{ borderRadius: 999, width: 260 }} />
          </form>
        </div>
        <div className="card card-flush">
          {shown.length === 0 ? <Empty>Aucune facture.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>N°</th><th>Client · projet</th><th>Objet</th><th>Émise</th><th>Échéance</th><th className="num">TTC</th><th className="num">Reste dû</th><th>État</th></tr></thead>
                <tbody>
                  {shown.map(({ i, t, s }) => (
                    <tr key={i.id} className="clickable">
                      <td><Link href={`/factures/${i.id}`} className="link mono">{i.number ?? "Brouillon"}</Link></td>
                      <td>{i.project.client.name}<div className="faint" style={{ fontSize: 12 }}>{i.project.reference} · {i.project.name}</div></td>
                      <td>{i.object}</td>
                      <td className="nowrap">{date(i.issueDate)}</td>
                      <td className="nowrap">{date(i.dueDate)}</td>
                      <td className="num">{money(t.total)}</td>
                      <td className="num">{i.status === "EMISE" ? money(t.due) : "—"}</td>
                      <td><Badge tone={INVOICE_STATUS_TONE[s]}>{INVOICE_STATUS_LABELS[s]}</Badge></td>
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
