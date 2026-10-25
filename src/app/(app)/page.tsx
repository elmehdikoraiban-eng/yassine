import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can, projectScope } from "@/lib/permissions";
import { PHASES, STEPS, stepLabel } from "@/lib/constants";
import { date, dateTime, money, num } from "@/lib/format";
import { feeSummary, invoiceStatus, invoiceTotals } from "@/lib/finance";
import { Topbar, Stat, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";

export default async function Dashboard() {
  const user = await requireUser();
  const finance = can(user, "seeFinance");
  const scope = projectScope(user);
  // Toutes les lectures partent en même temps : la page attend la plus lente, pas leur somme.
  const visibleIds = can(user, "seeAllProjects") ? null : prisma.project.findMany({ where: scope, select: { id: true } }).then((r) => r.map((p) => p.id));
  const activityWhere = async () => {
    if (finance) {
      const ids = await visibleIds;
      return ids ? { OR: [{ projectId: { in: ids } }, { projectId: null, entity: { not: "Utilisateur" } }] } : { entity: { not: "Utilisateur" } };
    }
    const ids = (await visibleIds) ?? [];
    return { projectId: { in: ids }, entity: { notIn: ["Facture", "Contrat", "Règlement"] } };
  };
  const [projects, closed, plansToCheck, activity, allInvoices] = await Promise.all([
    prisma.project.findMany({
      where: { ...scope, status: { in: ["EN_COURS", "SUSPENDU"] } },
      include: {
        client: { select: { name: true } },
        contract: { include: { milestones: true } },
        invoices: { include: { payments: true } },
      },
    }),
    prisma.project.count({ where: { ...scope, status: { in: ["CLOTURE", "ARCHIVE"] } } }),
    prisma.document.findMany({
      where: { project: scope, planStatus: "A_VERIFIER" },
      include: { project: { select: { reference: true } } },
      take: 8,
    }),
    activityWhere().then((where) =>
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { name: true } } },
      }),
    ),
    finance
      ? prisma.invoice.findMany({ where: { status: "EMISE", project: scope }, include: { payments: true, project: { select: { name: true, client: { select: { name: true } } } } } })
      : Promise.resolve([]),
  ]);

  const byPhase = PHASES.map((ph) => ({ ph, n: projects.filter((p) => STEPS.find((s) => s.n === p.step)?.phase === ph).length }));
  const maxPhase = Math.max(1, ...byPhase.map((b) => b.n));
  const authorisation = projects.filter((p) => p.step >= 8 && p.step <= 10);
  const chantiers = projects.filter((p) => p.step >= 14 && p.step <= 17);

  // Échéances atteintes non facturées (§21 « factures à émettre »)
  const toInvoice = projects.flatMap((p) =>
    (p.contract?.milestones ?? [])
      .filter((m) => m.step != null && p.step >= m.step && !p.invoices.some((i) => i.milestoneId === m.id && i.status !== "ANNULEE"))
      .map((m) => ({ p, m, amount: (num(p.contract!.amountHT) * num(m.percent)) / 100 })),
  );
  const late = allInvoices.filter((i) => invoiceStatus(i) === "EN_RETARD");
  const fees = projects.reduce(
    (a, p) => {
      const s = feeSummary(num(p.contract?.amountHT), num(p.contract?.vatRate ?? 20), p.invoices);
      a.c += s.contractual; a.i += s.invoiced; a.e += s.collected; a.r += s.toCollect;
      return a;
    },
    { c: 0, i: 0, e: 0, r: 0 },
  );
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <Topbar crumbs={[{ label: "Tableau de bord" }]} />
      <div className="content">
        <section className="hero">
          <h1>Bonjour {firstName}, que cherchez-vous ?</h1>
          <form action="/recherche" className="composer">
            <input name="q" placeholder="Un client, un projet, une référence, une facture, un document…" autoComplete="off" />
            <button className="send" aria-label="Rechercher"><Icon name="arrowUp" /></button>
          </form>
          <div className="chips">
            {can(user, "manageProjects") && <Link href="/projets/nouveau" className="chip"><Icon name="plus" width={14} height={14} /> Nouveau projet</Link>}
            {can(user, "manageClients") && <Link href="/clients/nouveau" className="chip"><Icon name="users" width={14} height={14} /> Nouveau client</Link>}
            {finance && <Link href="/factures?filtre=impayees" className="chip"><Icon name="receipt" width={14} height={14} /> Factures impayées</Link>}
            <Link href="/projets" className="chip"><Icon name="folder" width={14} height={14} /> Projets en cours</Link>
          </div>
        </section>

        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <Stat label="Projets en cours" value={projects.length} sub={`${closed} clôturé(s) ou archivé(s)`} />
          <Stat label="Dossiers d'autorisation" value={authorisation.length} sub="Étapes 8 à 10" />
          <Stat label="Chantiers" value={chantiers.length} sub="Étapes 14 à 17" />
          {finance ? (
            <Stat label="Factures en retard" value={late.length} sub={money(late.reduce((s, i) => s + invoiceTotals(i).due, 0))} />
          ) : (
            <Stat label="Plans à vérifier" value={plansToCheck.length} />
          )}
        </div>

        {finance && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head"><h2>Honoraires des projets en cours</h2><span className="faint">TTC</span></div>
            <div className="grid grid-4">
              <div><div className="stat-label">Contractuels</div><div className="stat-value">{money(fees.c)}</div></div>
              <div><div className="stat-label">Facturés</div><div className="stat-value">{money(fees.i)}</div></div>
              <div><div className="stat-label">Encaissés</div><div className="stat-value">{money(fees.e)}</div></div>
              <div><div className="stat-label">Restant à encaisser</div><div className="stat-value">{money(fees.r)}</div></div>
            </div>
            <div className="progress dual" style={{ marginTop: 14, height: 8 }}>
              <span className="inv" style={{ width: `${fees.c ? (fees.i / fees.c) * 100 : 0}%` }} />
              <span className="col" style={{ width: `${fees.c ? (fees.e / fees.c) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        <div className="grid grid-2">
          <div className="card">
            <div className="card-head"><h2>Répartition par phase</h2></div>
            <div className="stack" style={{ gap: 10 }}>
              {byPhase.map((b) => (
                <div key={b.ph}>
                  <div className="row" style={{ justifyContent: "space-between" }}><span>{b.ph}</span><span className="faint">{b.n}</span></div>
                  <div className="progress"><span style={{ width: `${(b.n / maxPhase) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>À traiter</h2></div>
            <div className="list">
              {finance && toInvoice.map(({ p, m, amount }) => (
                <Link key={m.id} href={`/projets/${p.id}/finances`} className="list-item">
                  <Badge tone="danger">À facturer</Badge>
                  <div className="grow"><p>{m.label} · {p.name}</p><p className="faint" style={{ fontSize: 12.5 }}>{money(amount)} HT · {p.client.name}</p></div>
                </Link>
              ))}
              {finance && late.map((i) => (
                <Link key={i.id} href={`/factures/${i.id}`} className="list-item">
                  <Badge tone="danger">En retard</Badge>
                  <div className="grow"><p>{i.number} · {i.project.client.name}</p><p className="faint" style={{ fontSize: 12.5 }}>Échue le {date(i.dueDate)} · reste {money(invoiceTotals(i).due)}</p></div>
                </Link>
              ))}
              {plansToCheck.map((d) => (
                <Link key={d.id} href={`/documents/${d.id}`} className="list-item">
                  <Badge tone="warn">À vérifier</Badge>
                  <div className="grow"><p>{d.title}</p><p className="faint" style={{ fontSize: 12.5 }}>{d.project.reference}</p></div>
                </Link>
              ))}
              {authorisation.map((p) => (
                <Link key={p.id} href={`/projets/${p.id}`} className="list-item">
                  <Badge tone="info">Autorisation</Badge>
                  <div className="grow"><p>{p.name}</p><p className="faint" style={{ fontSize: 12.5 }}>{stepLabel(p.step)}</p></div>
                </Link>
              ))}
              {!toInvoice.length && !late.length && !plansToCheck.length && !authorisation.length && <p className="faint">Rien d'urgent.</p>}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head"><h2>Activité récente</h2></div>
          <div className="list">
            {activity.map((a) => (
              <div key={a.id} className="list-item">
                <Badge plain>{a.entity}</Badge>
                <div className="grow"><p>{a.summary}</p><p className="faint" style={{ fontSize: 12.5 }}>{dateTime(a.createdAt)} · {a.user?.name ?? "Système"}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
