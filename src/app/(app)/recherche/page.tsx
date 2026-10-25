import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can, projectScope } from "@/lib/permissions";
import { FOLDERS, stepLabel } from "@/lib/constants";
import { date, money } from "@/lib/format";
import { invoiceTotals } from "@/lib/finance";
import { Topbar, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";

// §22 — Recherche transversale : chaque résultat renvoie vers son dossier d'origine.
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const term = q.trim();
  const ci = { contains: term, mode: "insensitive" as const };
  const scope = projectScope(user);
  const financeFolders = FOLDERS.filter((f) => f.finance).map((f) => f.code);

  const [clients, projects, documents, stakeholders, invoices] = term
    ? await Promise.all([
        can(user, "seeClients")
          ? prisma.client.findMany({ where: { OR: [{ name: ci }, { city: ci }, { ice: ci }, { phone: ci }, { email: ci }, { cin: ci }] }, take: 10 })
          : [],
        prisma.project.findMany({
          where: { ...scope, OR: [{ name: ci }, { reference: ci }, { city: ci }, { location: ci }, { landTitle: ci }, { nature: ci }, { client: { name: ci } }] },
          include: { client: { select: { name: true } } },
          take: 10,
        }),
        prisma.document.findMany({
          where: {
            project: scope,
            OR: [{ title: ci }, { planCode: ci }, { versions: { some: { fileName: ci } } }],
            ...(can(user, "seeFinance") ? {} : { folder: { notIn: financeFolders } }),
          },
          include: { project: { select: { reference: true, name: true } } },
          take: 15,
        }),
        prisma.stakeholder.findMany({ where: { OR: [{ name: ci }, { contact: ci }, { email: ci }] }, take: 10 }),
        can(user, "seeFinance")
          ? prisma.invoice.findMany({
              where: { OR: [{ number: ci }, { object: ci }, { payments: { some: { reference: ci } } }] },
              include: { payments: true, project: { select: { name: true } } },
              take: 10,
            })
          : [],
      ])
    : [[], [], [], [], []];
  const total = clients.length + projects.length + documents.length + stakeholders.length + invoices.length;

  const Section = ({ title, children, n }: { title: string; children: React.ReactNode; n: number }) =>
    n ? (
      <div className="card">
        <div className="card-head"><h2>{title}</h2><span className="faint">{n}</span></div>
        <div className="list">{children}</div>
      </div>
    ) : null;

  return (
    <>
      <Topbar crumbs={[{ label: "Recherche" }]} />
      <div className="content" style={{ maxWidth: 860 }}>
        <section className="hero" style={{ paddingBottom: 18 }}>
          <form className="composer">
            <input name="q" defaultValue={q} autoFocus placeholder="Client, projet, référence, titre foncier, document, intervenant, facture, n° de chèque…" />
            <button className="send" aria-label="Rechercher"><Icon name="arrowUp" /></button>
          </form>
        </section>
        {term && <p className="muted" style={{ marginBottom: 14 }}>{total} résultat{total > 1 ? "s" : ""} pour « {term} »</p>}
        <div className="stack">
          <Section title="Clients" n={clients.length}>
            {clients.map((c) => <Link key={c.id} href={`/clients/${c.id}`} className="list-item"><div className="grow"><p>{c.name}</p><p className="faint">{[c.city, c.phone].filter(Boolean).join(" · ")}</p></div></Link>)}
          </Section>
          <Section title="Projets" n={projects.length}>
            {projects.map((p) => <Link key={p.id} href={`/projets/${p.id}`} className="list-item"><span className="mono faint">{p.reference}</span><div className="grow"><p>{p.name}</p><p className="faint">{p.client.name} · {stepLabel(p.step)}</p></div></Link>)}
          </Section>
          <Section title="Documents et plans" n={documents.length}>
            {documents.map((d) => <Link key={d.id} href={`/documents/${d.id}`} className="list-item"><div className="grow"><p>{d.title}</p><p className="faint">{d.project.reference} · {d.folder}</p></div>{d.state === "OBSOLETE" && <Badge tone="muted">Obsolète</Badge>}</Link>)}
          </Section>
          <Section title="Intervenants" n={stakeholders.length}>
            {stakeholders.map((s) => <Link key={s.id} href="/intervenants" className="list-item"><div className="grow"><p>{s.name}</p><p className="faint">{[s.contact, s.phone].filter(Boolean).join(" · ")}</p></div></Link>)}
          </Section>
          <Section title="Factures et règlements" n={invoices.length}>
            {invoices.map((i) => <Link key={i.id} href={`/factures/${i.id}`} className="list-item"><span className="mono">{i.number ?? "Brouillon"}</span><div className="grow"><p>{i.object}</p><p className="faint">{i.project.name} · {date(i.issueDate)} · {money(invoiceTotals(i).total)}</p></div></Link>)}
          </Section>
        </div>
      </div>
    </>
  );
}
