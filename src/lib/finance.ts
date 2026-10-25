import type { Invoice, Payment } from "@prisma/client";
import { num, round2 } from "./format";

export type InvoiceWithPayments = Invoice & { payments: Pick<Payment, "amount">[] };

export const ttc = (ht: number, vat: number) => round2(ht * (1 + vat / 100));

export function invoiceTotals(inv: InvoiceWithPayments) {
  const ht = num(inv.amountHT);
  const vat = num(inv.vatRate);
  const total = ttc(ht, vat);
  const paid = round2(inv.payments.reduce((s, p) => s + num(p.amount), 0));
  return { ht, vat, tva: round2(total - ht), total, paid, due: round2(total - paid) };
}

export type DisplayStatus = "BROUILLON" | "EMISE" | "PARTIELLE" | "REGLEE" | "EN_RETARD" | "ANNULEE";

/** §16 — État affiché, déduit des règlements et de l'échéance. */
export function invoiceStatus(inv: InvoiceWithPayments, now = new Date()): DisplayStatus {
  if (inv.status === "BROUILLON") return "BROUILLON";
  if (inv.status === "ANNULEE") return "ANNULEE";
  const { paid, due } = invoiceTotals(inv);
  if (due <= 0.004) return "REGLEE";
  if (inv.dueDate && inv.dueDate < now) return "EN_RETARD";
  if (paid > 0) return "PARTIELLE";
  return "EMISE";
}

export const INVOICE_STATUS_LABELS: Record<DisplayStatus, string> = {
  BROUILLON: "En préparation",
  EMISE: "Émise",
  PARTIELLE: "Partiellement réglée",
  REGLEE: "Réglée",
  EN_RETARD: "En retard",
  ANNULEE: "Annulée",
};

export const INVOICE_STATUS_TONE: Record<DisplayStatus, string> = {
  BROUILLON: "neutral",
  EMISE: "info",
  PARTIELLE: "warn",
  REGLEE: "ok",
  EN_RETARD: "danger",
  ANNULEE: "muted",
};

/** §14 — Contractuel, facturé, encaissé, restant à facturer et à encaisser (montants TTC). */
export function feeSummary(contractHT: number, contractVat: number, invoices: InvoiceWithPayments[]) {
  const live = invoices.filter((i) => i.status === "EMISE");
  const contractual = ttc(contractHT, contractVat);
  const invoiced = round2(live.reduce((s, i) => s + invoiceTotals(i).total, 0));
  const collected = round2(live.reduce((s, i) => s + invoiceTotals(i).paid, 0));
  return {
    contractual,
    invoiced,
    collected,
    toInvoice: round2(contractual - invoiced),
    toCollect: round2(invoiced - collected),
  };
}
