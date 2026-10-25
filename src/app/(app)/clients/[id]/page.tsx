import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CLIENT_TYPE_LABELS, NOTE_KIND_LABELS, PROJECT_STATUS_LABELS, stepLabel } from "@/lib/constants";
import { date, money, num, inputDate } from "@/lib/format";
import { quoteTotals, QUOTE_STATUS_LABELS, QUOTE_STATUS_TONE } from "@/lib/quote";
import { feeSummary, invoiceStatus, invoiceTotals, INVOICE_STATUS_LABELS, INVOICE_STATUS_TONE } from "@/lib/finance";
import { Topbar, PageHead, Badge, Stat, Empty, Field } from "@/components/ui";
import { Icon } from "@/components/icons";
import { addClientNote } from "@/app/actions/clients";
import { Form } from "@/components/form";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "seeClients")) notFound();
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: { orderBy: { createdAt: "desc" }, include: { contract: true, invoices: { include: { payments: true } } } },
      interactions: { orderBy: { date: "desc" }, include: { author: { select: { name: true } } } },
      quotes: { orderBy: { createdAt: "desc" }, include: { lines: { select: { quantity: true, unitPrice: true } } } },
    },
  });
  if (!client) notFound();

  const finance = can(user, "seeFinance");
  const allInvoices = client.projects.flatMap((p) => p.invoices.map((i) => ({ ...i, project: p })));
  const totals = client.projects.reduce(
    (acc, p) => {
      const s = feeSummary(num(p.contract?.amountHT), num(p.contract?.vatRate ?? 20), p.invoices);
      acc.contractual += s.contractual; acc.invoiced += s.invoiced; acc.collected += s.collected; acc.toCollect += s.toCollect;
      return acc;
    },
    { contractual: 0, invoiced: 0, collected: 0, toCollect: 0 },
  );

  const info: [string, string | null][] = [
    ["Type", CLIENT_TYPE_LABELS[client.type]],
    ["Interlocuteur", client.contact],
    ["Téléphone", client.phone],
    ["E-mail", client.email],
    ["Adresse", [client.address, client.city].filter(Boolean).join(", ") || null],
    ["N° CIN", client.cin],
    ["Expiration CIN", client.cinExpiryDate ? date(client.cinExpiryDate) : null],
    ["Nom du père", client.fatherName],
    ["Nom de la mère", client.motherName],
    ["ICE", client.ice],
    ["RC", client.rc],
    ["IF", client.ifiscal],
  ];

  return (
    <>
      <Topbar crumbs={[{ href: "/clients", label: "Clients" }, { label: client.name }]} />
      <div className="content">
        <PageHead
          title={client.name}
          subtitle={`Client depuis le ${date(client.createdAt)}`}
          actions={
            can(user, "manageClients") && (
              <>
                <Link href={`/clients/${id}/modifier`} className="btn"><Icon name="edit" /> Modifier</Link>
                {can(user, "manageFinance") && <Link href={`/devis/nouveau?client=${id}`} className="btn"><Icon name="file" /> Nouveau devis</Link>}
                <Link href={`/projets/nouveau?client=${id}`} className="btn btn-primary"><Icon name="plus" /> Nouveau projet</Link>
              </>
            )
          }
        />

        {finance && (
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <Stat label="Honoraires contractuels" value={money(totals.contractual)} sub="TTC, tous projets" />
            <Stat label="Facturé" value={money(totals.invoiced)} />
            <Stat label="Encaissé" value={money(totals.collected)} />
            <Stat label="Reste à encaisser" value={money(totals.toCollect)} />
          </div>
        )}

        <div className="split">
          <div className="stack">
            <div className="card card-flush">
              <div className="card-head"><h2>Projets</h2></div>
              {client.projects.length === 0 ? (
                <Empty>Aucun projet pour ce client.</Empty>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Référence</th><th>Projet</th><th>Étape</th><th>État</th></tr></thead>
                    <tbody>
                      {client.projects.map((p) => (
                        <tr key={p.id}>
                          <td className="mono">{p.reference}</td>
                          <td><Link className="link" href={`/projets/${p.id}`}>{p.name}</Link></td>
                          <td className="muted">{p.step}. {stepLabel(p.step)}</td>
                          <td><Badge tone={p.status === "EN_COURS" ? "ok" : "neutral"}>{PROJECT_STATUS_LABELS[p.status]}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {finance && client.quotes.length > 0 && (
              <div className="card card-flush">
                <div className="card-head"><h2>Devis</h2></div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>N°</th><th>Objet</th><th>Date</th><th className="num">TTC</th><th>État</th></tr></thead>
                    <tbody>
                      {client.quotes.map((d) => (
                        <tr key={d.id}>
                          <td><Link className="link mono" href={`/devis/${d.id}`}>{d.number}</Link></td>
                          <td>{d.object}</td>
                          <td>{date(d.issueDate)}</td>
                          <td className="num">{money(quoteTotals(d.lines, d.vatRate).total)}</td>
                          <td><Badge tone={QUOTE_STATUS_TONE[d.status]}>{QUOTE_STATUS_LABELS[d.status]}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {finance && (
              <div className="card card-flush">
                <div className="card-head"><h2>Factures</h2></div>
                {allInvoices.length === 0 ? (
                  <Empty>Aucune facture.</Empty>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>N°</th><th>Projet</th><th>Date</th><th className="num">TTC</th><th className="num">Reste dû</th><th>État</th></tr></thead>
                      <tbody>
                        {allInvoices.map((i) => {
                          const t = invoiceTotals(i);
                          const s = invoiceStatus(i);
                          return (
                            <tr key={i.id}>
                              <td><Link className="link mono" href={`/factures/${i.id}`}>{i.number ?? "Brouillon"}</Link></td>
                              <td>{i.project.name}</td>
                              <td>{date(i.issueDate)}</td>
                              <td className="num">{money(t.total)}</td>
                              <td className="num">{i.status === "EMISE" ? money(t.due) : "—"}</td>
                              <td><Badge tone={INVOICE_STATUS_TONE[s]}>{INVOICE_STATUS_LABELS[s]}</Badge></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="card">
              <div className="card-head"><h2>Historique des échanges</h2></div>
              {can(user, "manageClients") && (
                <Form action={addClientNote.bind(null, id)} className="form" style={{ marginBottom: 12 }}>
                  <div className="inline-form">
                    <select name="kind" defaultValue="APPEL">
                      {Object.entries(NOTE_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <input type="date" name="date" defaultValue={inputDate(new Date())} />
                  </div>
                  <textarea name="content" placeholder="Compte rendu de l'échange, demande ou observation…" required />
                  <div className="form-actions"><button className="btn btn-primary btn-sm">Ajouter</button></div>
                </Form>
              )}
              <div className="list">
                {client.interactions.length === 0 && <p className="faint">Aucun échange enregistré.</p>}
                {client.interactions.map((n) => (
                  <div key={n.id} className="list-item">
                    <Badge plain>{NOTE_KIND_LABELS[n.kind]}</Badge>
                    <div className="grow">
                      <p style={{ whiteSpace: "pre-wrap" }}>{n.content}</p>
                      <p className="faint" style={{ fontSize: 12.5, marginTop: 2 }}>{date(n.date)} · {n.author.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>Identification</h2></div>
            <dl className="kv">
              {info.map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt>{k}</dt>
                  <dd>{v ?? <span className="faint">—</span>}</dd>
                </div>
              ))}
            </dl>
            {client.notes && <p className="notice" style={{ marginTop: 14, whiteSpace: "pre-wrap" }}>{client.notes}</p>}
          </div>
        </div>
      </div>
    </>
  );
}

