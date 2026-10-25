import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { date, money, num } from "@/lib/format";
import { quoteExpired, quoteTotals, QUOTE_STATUS_LABELS, QUOTE_STATUS_TONE } from "@/lib/quote";
import { Topbar, PageHead, Badge, Stat, Field } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Form } from "@/components/form";
import { convertQuote, deleteQuote, duplicateQuote, setQuoteStatus } from "@/app/actions/quotes";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "seeFinance")) notFound();
  const q = await prisma.quote.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { order: "asc" } },
      client: { include: { projects: { where: { contract: null }, orderBy: { createdAt: "desc" }, select: { id: true, reference: true, name: true } } } },
      project: { select: { id: true, reference: true, name: true, landTitle: true } },
    },
  });
  if (!q) notFound();
  const manage = can(user, "manageFinance");
  const t = quoteTotals(q.lines, q.vatRate);
  const editable = q.status === "BROUILLON" || q.status === "ENVOYE";
  const users = q.status === "ACCEPTE" && !q.project && manage
    ? await prisma.user.findMany({ where: { active: true, id: { not: user.id } }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];

  return (
    <>
      <Topbar crumbs={[{ href: "/devis", label: "Devis" }, { label: q.number }]} />
      <div className="content">
        <PageHead
          title={<span className="row" style={{ gap: 12 }}>Devis {q.number} {quoteExpired(q) ? <Badge tone="warn">Expiré</Badge> : <Badge tone={QUOTE_STATUS_TONE[q.status]}>{QUOTE_STATUS_LABELS[q.status]}</Badge>}</span>}
          subtitle={<><Link href={`/clients/${q.client.id}`} className="link">{q.client.name}</Link> · {q.object}</>}
          actions={
            <>
              {manage && editable && <Link href={`/devis/${id}/modifier`} className="btn"><Icon name="edit" /> Modifier</Link>}
              <Link href={`/devis/${id}/imprimer`} className="btn"><Icon name="print" /> Imprimer / PDF</Link>
            </>
          }
        />
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <Stat label="Total HT" value={money(t.ht)} />
          <Stat label={`TVA ${t.vat} %`} value={money(t.tva)} />
          <Stat label="Total TTC" value={money(t.total)} />
          <Stat label="Valable jusqu'au" value={date(q.validUntil)} sub={`Établi le ${date(q.issueDate)}`} />
        </div>

        <div className="split">
          <div className="stack">
            <div className="card card-flush">
              <div className="card-head"><h2>Prestations</h2></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Désignation</th><th className="num">Qté</th><th>Unité</th><th className="num">Prix unitaire HT</th><th className="num">Montant HT</th></tr></thead>
                  <tbody>
                    {q.lines.map((l) => (
                      <tr key={l.id}>
                        <td>{l.label}</td>
                        <td className="num">{num(l.quantity).toLocaleString("fr-FR")}</td>
                        <td className="muted">{l.unit ?? ""}</td>
                        <td className="num">{money(l.unitPrice)}</td>
                        <td className="num">{money(num(l.quantity) * num(l.unitPrice))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td colSpan={4} className="right">Total HT</td><td className="num">{money(t.ht)}</td></tr>
                    <tr><td colSpan={4} className="right">TVA {t.vat} %</td><td className="num">{money(t.tva)}</td></tr>
                    <tr><td colSpan={4} className="right">Total TTC</td><td className="num">{money(t.total)}</td></tr>
                  </tfoot>
                </table>
              </div>
            </div>
            {q.notes && <div className="card"><div className="card-head"><h2>Conditions</h2></div><p style={{ whiteSpace: "pre-wrap" }}>{q.notes}</p></div>}
          </div>

          <div className="stack">
            {q.project && (
              <div className="notice ok">
                Projet ouvert : <Link href={`/projets/${q.project.id}/finances`} className="link">{q.project.reference} · {q.project.name}</Link>
              </div>
            )}

            {q.project?.landTitle && <div className="notice">Titre foncier du projet : {q.project.landTitle}</div>}

            {manage && !q.project && (
              <div className="card">
                <div className="card-head"><h2>Suivi</h2></div>
                <div className="row">
                  {q.status === "BROUILLON" && <Form action={setQuoteStatus.bind(null, id, "ENVOYE")}><button className="btn btn-primary btn-sm">Marquer comme envoyé</button></Form>}
                  {(q.status === "BROUILLON" || q.status === "ENVOYE") && (
                    <>
                      <Form action={setQuoteStatus.bind(null, id, "ACCEPTE")}><button className="btn btn-accent btn-sm">Accepté par le client</button></Form>
                      <Form action={setQuoteStatus.bind(null, id, "REFUSE")}><button className="btn btn-sm">Refusé</button></Form>
                    </>
                  )}
                  {(q.status === "ACCEPTE" || q.status === "REFUSE") && <Form action={setQuoteStatus.bind(null, id, "ENVOYE")}><button className="btn btn-ghost btn-sm">Annuler la réponse</button></Form>}
                </div>
              </div>
            )}

            {manage && q.status === "ACCEPTE" && !q.project && (
              <Form action={convertQuote.bind(null, id)} className="card form">
                <h2>Ouvrir le projet</h2>
                <p className="hint" style={{ marginTop: -6 }}>Crée le contrat d'honoraires ({money(t.ht)} HT) avec l'échéancier type, modifiable ensuite.</p>
                <Field label="Rattacher à">
                  <select name="target" defaultValue="new">
                    <option value="new">Un nouveau projet</option>
                    {q.client.projects.map((p) => <option key={p.id} value={p.id}>{p.reference} · {p.name}</option>)}
                  </select>
                </Field>
                <Field label="Nom du nouveau projet"><input name="name" defaultValue={q.object} /></Field>
                {users.length > 0 && (
                  <div className="field">
                    <span>Équipe (notifiée)</span>
                    <div className="row" style={{ gap: 12 }}>
                      {users.map((u) => <label key={u.id} className="check"><input type="checkbox" name="members" value={u.id} /> {u.name}</label>)}
                    </div>
                  </div>
                )}
                <button className="btn btn-primary">Ouvrir le projet et le contrat</button>
              </Form>
            )}

            {manage && (
              <div className="row">
                <Form action={duplicateQuote.bind(null, id)}><button className="btn btn-sm">Dupliquer</button></Form>
                {q.status === "BROUILLON" && <Form action={deleteQuote.bind(null, id)}><button className="btn btn-danger btn-sm">Supprimer</button></Form>}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

