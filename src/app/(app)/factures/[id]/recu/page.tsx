import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { date, money, num } from "@/lib/format";
import { Topbar } from "@/components/ui";
import { PrintButton } from "../imprimer/print-button";

export default async function PaymentReceipt({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paiement?: string }>;
}) {
  const { id } = await params;
  const { paiement } = await searchParams;
  const user = await requireUser();
  if (!can(user, "seeFinance") || !paiement) notFound();
  const [invoice, settings] = await Promise.all([
    prisma.invoice.findUnique({ where: { id }, include: { project: { include: { client: true } } } }),
    prisma.settings.findFirst(),
  ]);
  const payment = invoice ? await prisma.payment.findFirst({ where: { id: paiement, invoiceId: invoice.id } }) : null;
  if (!invoice || !payment) notFound();
  const totalTTC = Number(payment.amount);
  const totalHT = totalTTC / (1 + num(invoice.vatRate) / 100);
  const vat = totalTTC - totalHT;
  const client = invoice.project.client;
  return (
    <>
      <Topbar crumbs={[{ href: "/factures", label: "Factures" }, { href: "/factures/" + id, label: invoice.number ?? "Facture" }, { label: "Reçu" }]} />
      <div className="content">
        <div className="no-print row" style={{ justifyContent: "flex-end", margin: "12px 0" }}><PrintButton /></div>
        <div className="print-sheet card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
            <div><h1 style={{ fontSize: 20 }}>{settings?.name}</h1><p>{settings?.address}</p><p>{settings?.city}</p><p>{[settings?.phone, settings?.email].filter(Boolean).join(" · ")}</p></div>
            <div style={{ textAlign: "right" }}><h1 style={{ fontSize: 26 }}>REÇU DE PAIEMENT</h1><p>Facture {invoice.number ?? "—"}</p><p>Reçu le {date(payment.date)}</p></div>
          </div>
          <div style={{ margin: "28px 0", padding: 16, border: "1px solid #ddd", borderRadius: 10 }}>
            <p>Reçu de : <strong>{client.name}</strong></p>
            {client.contact && <p>Interlocuteur : {client.contact}</p>}
            {client.cin && <p>CIN : {client.cin}</p>}
            <p>Projet : {invoice.project.reference} — {invoice.project.name}</p>
            <p>Mode : {PAYMENT_METHOD_LABELS[payment.method]}{payment.reference ? " · Référence : " + payment.reference : ""}</p>
          </div>
          <table>
            <thead><tr><th>Désignation</th><th className="num">Montant</th></tr></thead>
            <tbody>
              <tr><td>Montant reçu HT</td><td className="num">{money(totalHT)}</td></tr>
              <tr><td>TVA ({num(invoice.vatRate)} %)</td><td className="num">{money(vat)}</td></tr>
            </tbody>
            <tfoot><tr><td className="right"><strong>Total reçu TTC</strong></td><td className="num"><strong>{money(totalTTC)}</strong></td></tr></tfoot>
          </table>
          <p style={{ marginTop: 20 }}>Ce reçu atteste du règlement partiel ou total de la facture {invoice.number ?? "—"}.</p>
          <div style={{ marginTop: 56, textAlign: "right" }}><p>Signature et cachet</p></div>
        </div>
      </div>
    </>
  );
}

