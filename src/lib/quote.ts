import type { Prisma, QuoteStatus } from "@prisma/client";
import { num, round2 } from "./format";

/** Totaux d'un devis : somme des lignes (quantité × prix unitaire HT), TVA et TTC. */
type Amount = number | Prisma.Decimal;

export function quoteTotals(lines: { quantity: Amount; unitPrice: Amount }[], vatRate: Amount) {
  const ht = round2(lines.reduce((s, l) => s + num(l.quantity) * num(l.unitPrice), 0));
  const vat = num(vatRate);
  const total = round2(ht * (1 + vat / 100));
  return { ht, vat, tva: round2(total - ht), total };
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  BROUILLON: "En préparation",
  ENVOYE: "Envoyé",
  ACCEPTE: "Accepté",
  REFUSE: "Refusé",
};

export const QUOTE_STATUS_TONE: Record<QuoteStatus, string> = {
  BROUILLON: "neutral",
  ENVOYE: "info",
  ACCEPTE: "ok",
  REFUSE: "muted",
};

/** Un devis envoyé dont la date de validité est dépassée. */
export const quoteExpired = (q: { status: QuoteStatus; validUntil: Date | null }, now = new Date()) =>
  q.status === "ENVOYE" && q.validUntil != null && q.validUntil < now;
