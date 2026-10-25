import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { STEPS, stepLabel } from "@/lib/constants";
import { date, inputDate, money, num, round2 } from "@/lib/format";
import { feeSummary, invoiceStatus, invoiceTotals, INVOICE_STATUS_LABELS, INVOICE_STATUS_TONE, ttc } from "@/lib/finance";
import { Badge, Empty, Field, Stat } from "@/components/ui";
import { createInvoice, saveContract, saveSchedule } from "@/app/actions/finance";
import { Form } from "@/components/form";

export default async function ProjectFinances({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "seeFinance")) notFound();
  const manage = can(user, "manageFinance");
  const [p, settings] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id },
      include: {
        contract: { include: { milestones: { orderBy: { order: "asc" } } } },
        invoices: { orderBy: { createdAt: "desc" }, include: { payments: true } },
      },
    }),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);
  const c = p.contract;
  const fees = c ? feeSummary(num(c.amountHT), num(c.vatRate), p.invoices) : null;

  const milestoneRows = (c?.milestones ?? []).map((m) => {
    const invs = p.invoices.filter((i) => i.milestoneId === m.id && i.status !== "ANNULEE");
    const amountHT = round2((num(c!.amountHT) * num(m.percent)) / 100);
    const issued = invs.filter((i) => i.status === "EMISE");
    const invoiced = issued.reduce((s, i) => s + invoiceTotals(i).total, 0);
    const paid = issued.reduce((s, i) => s + invoiceTotals(i).paid, 0);
    const reached = m.step != null && p.step >= m.step;
    const draft = invs.find((i) => i.status === "BROUILLON");
    let state: [string, string];
    if (issued.length && paid >= invoiced - 0.004) state = ["Encaissée", "ok"];
    else if (issued.length && paid > 0) state = ["Partiellement réglée", "warn"];
    else if (issued.length) state = ["Facturée", "info"];
    else if (draft) state = ["Facture en préparation", "neutral"];
    else if (reached) state = ["À facturer", "danger"];
    else state = ["À venir", "neutral"];
    return { m, amountHT, invoiced, paid, reached, state, draft, hasInvoice: invs.length > 0 };
  });

  return (
    <div className="stack">
      {fees && (
        <div className="grid grid-4">
          <Stat label="Honoraires contractuels" value={money(fees.contractual)} sub={`${money(c!.amountHT)} HT · TVA ${num(c!.vatRate)} %`} />
          <Stat label="Facturé" value={money(fees.invoiced)} sub={`Reste à facturer : ${money(fees.toInvoice)}`} />
          <Stat label="Encaissé" value={money(fees.collected)} />
          <Stat label="Reste à encaisser" value={money(fees.toCollect)} />
        </div>
      )}

      {c && (
        <div className="card card-flush">
          <div className="card-head">
            <h2>Avancement × échéancier</h2>
            <span className="faint">Projet à l'étape {p.step} : {stepLabel(p.step)}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Échéance</th><th>Étape liée</th><th className="num">%</th><th className="num">Montant TTC</th><th className="num">Encaissé</th><th>Situation</th><th /></tr></thead>
              <tbody>
                {milestoneRows.map(({ m, amountHT, paid, state, draft, hasInvoice }) => (
                  <tr key={m.id}>
                    <td>{m.label}{m.dueDate && <div className="faint" style={{ fontSize: 12 }}>Prévue le {date(m.dueDate)}</div>}</td>
                    <td className="muted" style={{ fontSize: 13 }}>{m.step ? `${m.step}. ${stepLabel(m.step)}` : "—"}</td>
                    <td className="num">{num(m.percent)} %</td>
                    <td className="num">{money(ttc(amountHT, num(c.vatRate)))}</td>
                    <td className="num">{paid ? money(paid) : "—"}</td>
                    <td><Badge tone={state[1]}>{state[0]}</Badge></td>
                    <td className="right">
                      {draft ? (
                        <Link href={`/factures/${draft.id}`} className="btn btn-sm">Ouvrir</Link>
                      ) : manage && !hasInvoice ? (
                        <Form action={createInvoice.bind(null, id)}>
                          <input type="hidden" name="milestoneId" value={m.id} />
                          <button className="btn btn-sm">Facturer</button>
                        </Form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="split">
        <div className="card card-flush">
          <div className="card-head"><h2>Factures du projet</h2></div>
          {p.invoices.length === 0 ? <Empty>Aucune facture.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>N°</th><th>Objet</th><th>Émise le</th><th className="num">TTC</th><th className="num">Reste dû</th><th>État</th></tr></thead>
                <tbody>
                  {p.invoices.map((i) => {
                    const t = invoiceTotals(i);
                    const s = invoiceStatus(i);
                    return (
                      <tr key={i.id} className="clickable">
                        <td><Link href={`/factures/${i.id}`} className="link mono">{i.number ?? "Brouillon"}</Link></td>
                        <td>{i.object}</td>
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

        {manage && (
          <div className="stack">
            <Form action={saveContract.bind(null, id)} className="card form">
              <h2>{c ? "Contrat d'honoraires" : "Fixer les honoraires"}</h2>
              <Field label="Montant HT (MAD)"><input name="amountHT" inputMode="decimal" required defaultValue={c ? num(c.amountHT) : ""} /></Field>
              <Field label="TVA (%)"><input name="vatRate" inputMode="decimal" defaultValue={c ? num(c.vatRate) : num(settings?.vatRate ?? 20)} /></Field>
              <Field label="Date de signature"><input type="date" name="signedAt" defaultValue={inputDate(c?.signedAt)} /></Field>
              <Field label={c ? "Motif de la modification (avenant)" : "Conditions"}><input name="notes" defaultValue={c ? "" : ""} /></Field>
              <button className="btn btn-primary">{c ? "Enregistrer l'avenant" : "Créer avec l'échéancier type"}</button>
              {!c && <p className="hint">Échéancier type : signature 20 %, conception 20 %, autorisation 20 %, exécution 20 %, fin des travaux 10 %, permis d'habiter 10 %. Modifiable ensuite.</p>}
            </Form>
            <Form action={createInvoice.bind(null, id)} className="card form">
              <h2>Facture libre</h2>
              <Field label="Objet"><input name="object" required placeholder="Ex. Honoraires complémentaires" /></Field>
              <Field label="Montant HT (MAD)"><input name="amountHT" inputMode="decimal" required /></Field>
              <button className="btn">Préparer</button>
            </Form>
          </div>
        )}
      </div>

      {manage && c && (
        <Form action={saveSchedule.bind(null, id)} className="card">
          <div className="card-head">
            <h2>Modifier l'échéancier</h2>
            <span className="faint">Le total doit faire 100 %. Chaque modification est tracée.</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Libellé</th><th style={{ width: 90 }}>%</th><th>Étape déclenchante</th><th>Date prévue</th><th>Supprimer</th></tr></thead>
              <tbody>
                {[...c.milestones.map((m) => ({ id: m.id, label: m.label, percent: num(m.percent), step: m.step, dueDate: m.dueDate })), { id: "new1", label: "", percent: 0, step: null, dueDate: null }].map((m) => (
                  <tr key={m.id}>
                    <td><input type="hidden" name="mid" value={m.id} /><input name="label" defaultValue={m.label} placeholder={m.id.startsWith("new") ? "Ajouter une échéance…" : ""} /></td>
                    <td><input name="percent" inputMode="decimal" defaultValue={m.percent || ""} /></td>
                    <td>
                      <select name="step" defaultValue={m.step ?? ""}>
                        <option value="">—</option>
                        {STEPS.map((s) => <option key={s.n} value={s.n}>{s.n}. {s.label}</option>)}
                      </select>
                    </td>
                    <td><input type="date" name="dueDate" defaultValue={inputDate(m.dueDate)} /></td>
                    <td className="right">{!m.id.startsWith("new") && <input type="checkbox" name="remove" value={m.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions" style={{ marginTop: 12 }}><button className="btn btn-primary">Enregistrer l'échéancier</button></div>
        </Form>
      )}
    </div>
  );
}
