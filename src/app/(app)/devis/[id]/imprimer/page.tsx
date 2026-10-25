import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { date, money, num } from "@/lib/format";
import { quoteTotals } from "@/lib/quote";
import { inWords } from "@/lib/words";
import { PrintButton } from "../../../factures/[id]/imprimer/print-button";

export default async function PrintQuote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "seeFinance")) notFound();
  const [q, s] = await Promise.all([
    prisma.quote.findUnique({ where: { id }, include: { lines: { orderBy: { order: "asc" } }, client: true, project: { select: { landTitle: true } } } }),
    prisma.settings.findFirst({ }),
  ]);
  if (!q) notFound();
  const t = quoteTotals(q.lines, q.vatRate);
  const c = q.client;

  return (
    <div className="content">
      <div className="no-print row" style={{ justifyContent: "flex-end", margin: "12px 0" }}><PrintButton /></div>
      <div className="print-sheet card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
          <div>
            {s?.logoPath && <img src={`/api/marque/logo?v=${s.brandVersion}`} alt="" style={{ height: 48, marginBottom: 8, objectFit: "contain" }} />}
            <h1 style={{ fontSize: 20 }}>{s?.name}</h1>
            <p>{s?.address}</p>
            <p>{s?.city}</p>
            <p>{[s?.phone, s?.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <h1 style={{ fontSize: 26, letterSpacing: "0.04em" }}>DEVIS</h1>
            <p style={{ fontWeight: 600 }}>N° {q.number}</p>
            <p>Date : {date(q.issueDate)}</p>
            {q.validUntil && <p>Valable jusqu'au : {date(q.validUntil)}</p>}
          </div>
        </div>
        <div style={{ margin: "28px 0", padding: 16, border: "1px solid #ddd", borderRadius: 10, maxWidth: 380, marginLeft: "auto" }}>
          <p style={{ fontWeight: 600 }}>{c.name}</p>
          {c.contact && <p>À l'attention de {c.contact}</p>}
          <p>{c.address}</p>
          <p>{c.city}</p>
          {c.ice && <p>ICE : {c.ice}</p>}
          {c.cin && <p>CIN : {c.cin}</p>}
          {c.cinExpiryDate && <p>Expiration CIN : {date(c.cinExpiryDate)}</p>}
          {c.fatherName && <p>Nom du père : {c.fatherName}</p>}
          {c.motherName && <p>Nom de la mère : {c.motherName}</p>}
        </div>
        {q.project?.landTitle && <p style={{ marginBottom: 10 }}>Titre foncier du projet : <strong>{q.project.landTitle}</strong></p>}
        <p style={{ marginBottom: 10 }}>Objet : <strong>{q.object}</strong></p>
        <table>
          <thead><tr><th>Désignation</th><th className="num">Qté</th><th>Unité</th><th className="num">P.U. HT</th><th className="num">Montant HT</th></tr></thead>
          <tbody>
            {q.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.label}</td>
                <td className="num">{num(l.quantity).toLocaleString("fr-FR")}</td>
                <td>{l.unit ?? ""}</td>
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
        <p style={{ marginTop: 18 }}>Arrêté le présent devis à la somme de : <strong>{inWords(t.total)}</strong> TTC.</p>
        {q.notes && <p style={{ marginTop: 14, whiteSpace: "pre-wrap" }}>{q.notes}</p>}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, gap: 24 }}>
          <div><p style={{ fontWeight: 600 }}>Pour le cabinet</p><p style={{ color: "#777", fontSize: 12 }}>Signature et cachet</p></div>
          <div style={{ textAlign: "right" }}><p style={{ fontWeight: 600 }}>Bon pour accord, le client</p><p style={{ color: "#777", fontSize: 12 }}>Date, signature, mention « lu et approuvé »</p></div>
        </div>
        <hr style={{ margin: "60px 0 12px", border: 0, borderTop: "1px solid #ddd" }} />
        <p style={{ fontSize: 11.5, color: "#555", textAlign: "center" }}>
          {[s?.ice && `ICE ${s.ice}`, s?.ifiscal && `IF ${s.ifiscal}`, s?.rc && `RC ${s.rc}`, s?.patente && `Patente ${s.patente}`, s?.cnss && `CNSS ${s.cnss}`].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}



