import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { date, dateTime, inputDate, money, num } from "@/lib/format";
import { invoiceStatus, invoiceTotals, INVOICE_STATUS_LABELS, INVOICE_STATUS_TONE } from "@/lib/finance";
import { Topbar, PageHead, Badge, Stat, Field } from "@/components/ui";
import { Icon } from "@/components/icons";
import { addPayment, addReminder, cancelInvoice, deleteDraft, deletePayment, issueInvoice, updateDraft } from "@/app/actions/finance";
import { Form } from "@/components/form";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "seeFinance")) notFound();
  const [inv, settings] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        payments: { orderBy: { date: "asc" } },
        reminders: { orderBy: { date: "desc" } },
        milestone: true,
        project: { include: { client: true } },
      },
    }),
    prisma.settings.findFirst({ }),
  ]);
  if (!inv) notFound();
  const t = invoiceTotals(inv);
  const s = invoiceStatus(inv);
  const manage = can(user, "manageFinance");
  const defaultDue = new Date(Date.now() + (settings?.paymentDays ?? 30) * 86400000);

  return (
    <>
      <Topbar crumbs={[{ href: "/factures", label: "Factures" }, { label: inv.number ?? "Brouillon" }]} />
      <div className="content">
        <PageHead
          title={<span className="row" style={{ gap: 12 }}>{inv.number ?? "Facture en préparation"} <Badge tone={INVOICE_STATUS_TONE[s]}>{INVOICE_STATUS_LABELS[s]}</Badge></span>}
          subtitle={<><Link href={`/clients/${inv.project.client.id}`} className="link">{inv.project.client.name}</Link> · <Link href={`/projets/${inv.project.id}/finances`} className="link">{inv.project.reference} {inv.project.name}</Link></>}
          actions={<Link href={`/factures/${id}/imprimer`} className="btn"><Icon name="print" /> Imprimer / PDF</Link>}
        />
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <Stat label="Montant HT" value={money(t.ht)} />
          <Stat label={`TVA ${t.vat} %`} value={money(t.tva)} />
          <Stat label="Total TTC" value={money(t.total)} />
          <Stat label="Reste dû" value={money(inv.status === "EMISE" ? t.due : 0)} sub={inv.dueDate ? `Échéance le ${date(inv.dueDate)}` : undefined} />
        </div>
        {inv.status === "ANNULEE" && <div className="notice danger" style={{ marginBottom: 16 }}>Facture annulée : {inv.cancelReason}</div>}

        <div className="split">
          <div className="stack">
            <div className="card">
              <div className="card-head"><h2>Détail</h2></div>
              <dl className="kv">
                <dt>Objet</dt><dd>{inv.object}</dd>
                <dt>Échéance de l'échéancier</dt><dd>{inv.milestone ? `${inv.milestone.label} (${num(inv.milestone.percent)} %)` : "Facture libre"}</dd>
                <dt>Date d'émission</dt><dd>{date(inv.issueDate)}</dd>
                <dt>Date d'échéance</dt><dd>{date(inv.dueDate)}</dd>
              </dl>
            </div>

            <div className="card card-flush">
              <div className="card-head"><h2>Règlements</h2></div>
              {inv.payments.length === 0 ? <p className="empty">Aucun règlement.</p> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Date</th><th>Mode</th><th>Référence</th><th>Saisi par</th><th className="num">Montant</th><th /></tr></thead>
                    <tbody>
                      {inv.payments.map((p) => (
                        <tr key={p.id}>
                          <td>{date(p.date)}</td>
                          <td>{PAYMENT_METHOD_LABELS[p.method]}</td>
                          <td className="mono">{p.reference ?? "—"}</td>
                          <td>{p.userName}</td>
                          <td className="num">{money(p.amount)}</td>
                          <td className="right">{can(user, "cancelInvoice") && <Form action={deletePayment.bind(null, p.id)}><button className="btn btn-ghost btn-sm">Supprimer</button></Form>}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr><td colSpan={4}>Total encaissé</td><td className="num">{money(t.paid)}</td><td /></tr></tfoot>
                  </table>
                </div>
              )}
            </div>

            {inv.status === "EMISE" && (
              <div className="card">
                <div className="card-head"><h2>Relances</h2></div>
                {inv.reminders.length === 0 && <p className="faint">Aucune relance.</p>}
                <div className="list">
                  {inv.reminders.map((r) => (
                    <div key={r.id} className="list-item">
                      <Badge plain>{r.channel}</Badge>
                      <div className="grow"><p>{r.note ?? "—"}</p><p className="faint" style={{ fontSize: 12.5 }}>{dateTime(r.date)} · {r.userName}</p></div>
                    </div>
                  ))}
                </div>
                {manage && (
                  <Form action={addReminder.bind(null, id)} className="inline-form" style={{ marginTop: 12 }}>
                    <select name="channel" defaultValue="Téléphone">
                      {["Téléphone", "E-mail", "WhatsApp", "Courrier", "Visite"].map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <input name="note" placeholder="Réponse du client, engagement de paiement…" style={{ flex: 1, minWidth: 200 }} />
                    <button className="btn btn-sm">Enregistrer la relance</button>
                  </Form>
                )}
              </div>
            )}
          </div>

          {manage && (
            <div className="stack">
              {inv.status === "BROUILLON" && (
                <>
                  <Form action={updateDraft.bind(null, id)} className="card form">
                    <h2>Modifier le brouillon</h2>
                    <Field label="Objet"><input name="object" defaultValue={inv.object} /></Field>
                    <Field label="Montant HT"><input name="amountHT" inputMode="decimal" defaultValue={num(inv.amountHT)} /></Field>
                    <Field label="TVA (%)"><input name="vatRate" inputMode="decimal" defaultValue={num(inv.vatRate)} /></Field>
                    <button className="btn">Enregistrer</button>
                  </Form>
                  <Form action={issueInvoice.bind(null, id)} className="card form">
                    <h2>Émettre</h2>
                    <Field label="Date d'émission"><input type="date" name="issueDate" defaultValue={inputDate(new Date())} /></Field>
                    <Field label="Date d'échéance"><input type="date" name="dueDate" defaultValue={inputDate(defaultDue)} /></Field>
                    <button className="btn btn-primary">Émettre et numéroter</button>
                    <p className="hint">Le numéro est attribué à l'émission, sans trou. La facture n'est plus modifiable ensuite.</p>
                  </Form>
                  <Form action={deleteDraft.bind(null, id)}><button className="btn btn-danger" style={{ width: "100%" }}>Supprimer le brouillon</button></Form>
                </>
              )}
              {inv.status === "EMISE" && t.due > 0 && (
                <Form action={addPayment.bind(null, id)} className="card form">
                  <h2>Enregistrer un règlement</h2>
                  <Field label="Montant (MAD)"><input name="amount" inputMode="decimal" defaultValue={t.due} required /></Field>
                  <Field label="Date"><input type="date" name="date" defaultValue={inputDate(new Date())} /></Field>
                  <Field label="Mode">
                    <select name="method" defaultValue="VIREMENT">
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Référence"><input name="reference" placeholder="N° de chèque, de virement…" /></Field>
                  <button className="btn btn-accent">Enregistrer</button>
                </Form>
              )}
              {inv.status === "EMISE" && t.paid === 0 && can(user, "cancelInvoice") && (
                <Form action={cancelInvoice.bind(null, id)} className="card form">
                  <h2>Annuler la facture</h2>
                  <input name="reason" placeholder="Motif (obligatoire)" required />
                  <button className="btn btn-danger">Annuler</button>
                  <p className="hint">Le numéro reste attribué et la facture reste consultable.</p>
                </Form>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}


