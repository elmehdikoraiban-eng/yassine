import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { date, money } from "@/lib/format";
import { invoiceTotals } from "@/lib/finance";
import { PrintButton } from "./print-button";
import { inWords } from "@/lib/words";

export default async function PrintInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "seeFinance")) notFound();
  const [inv, s] = await Promise.all([
    prisma.invoice.findUnique({ where: { id }, include: { payments: true, project: { include: { client: true } } } }),
    prisma.settings.findFirst({ }),
  ]);
  if (!inv) notFound();
  const t = invoiceTotals(inv);
  const c = inv.project.client;

  return (
    <div className="content">
      <div className="no-print row" style={{ justifyContent: "flex-end", margin: "12px 0" }}><PrintButton /></div>
      <div className="print-sheet card">
        {inv.status !== "EMISE" && <p style={{ color: "#c00", fontWeight: 600, marginBottom: 16 }}>{inv.status === "BROUILLON" ? "BROUILLON — non émise" : `ANNULÉE — ${inv.cancelReason}`}</p>}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
          <div>
            <h1 style={{ fontSize: 20 }}>{s?.name}</h1>
            <p>{s?.address}</p>
            <p>{s?.city}</p>
            <p>{[s?.phone, s?.email].filter(Boolean).join(" · ")}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <h1 style={{ fontSize: 26, letterSpacing: "0.04em" }}>FACTURE</h1>
            <p style={{ fontWeight: 600 }}>N° {inv.number ?? "—"}</p>
            <p>Date : {date(inv.issueDate)}</p>
            <p>Échéance : {date(inv.dueDate)}</p>
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
        <p style={{ marginBottom: 10 }}>Projet : {inv.project.reference} — {inv.project.name}{inv.project.city ? `, ${inv.project.city}` : ""}</p>
        {inv.project.landTitle && <p style={{ marginTop: 8 }}>Titre foncier : {inv.project.landTitle}</p>}
        <table>
          <thead><tr><th>Désignation</th><th className="num">Montant HT</th></tr></thead>
          <tbody><tr><td>{inv.object}</td><td className="num">{money(t.ht)}</td></tr></tbody>
          <tfoot>
            <tr><td className="right">Total HT</td><td className="num">{money(t.ht)}</td></tr>
            <tr><td className="right">TVA {t.vat} %</td><td className="num">{money(t.tva)}</td></tr>
            <tr><td className="right">Total TTC</td><td className="num">{money(t.total)}</td></tr>
          </tfoot>
        </table>
        <p style={{ marginTop: 18 }}>Arrêtée la présente facture à la somme de : <strong>{inWords(t.total)}</strong> TTC.</p>
        {s?.rib && <p style={{ marginTop: 10 }}>Règlement par virement : RIB {s.rib}</p>}
        <hr style={{ margin: "36px 0 12px", border: 0, borderTop: "1px solid #ddd" }} />
        <p style={{ fontSize: 11.5, color: "#555", textAlign: "center" }}>
          {[s?.ice && `ICE ${s.ice}`, s?.ifiscal && `IF ${s.ifiscal}`, s?.rc && `RC ${s.rc}`, s?.patente && `Patente ${s.patente}`, s?.cnss && `CNSS ${s.cnss}`].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}



