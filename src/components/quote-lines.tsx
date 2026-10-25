"use client";

import { useState } from "react";
import { Icon } from "./icons";
import "./quote-lines.css";

type Line = { key: number; label: string; quantity: string; unit: string; unitPrice: string };

const n = (v: string) => {
  const x = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};
const fmt = (v: number) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} MAD`;

/** Lignes du devis : ajout, suppression et totaux recalculés à la saisie. */
export function QuoteLines({ initial, vatRate }: { initial: Omit<Line, "key">[]; vatRate: number }) {
  const [lines, setLines] = useState<Line[]>(() =>
    (initial.length ? initial : [{ label: "", quantity: "1", unit: "forfait", unitPrice: "" }]).map((l, i) => ({ ...l, key: i })),
  );
  const [vat, setVat] = useState(String(vatRate));
  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const add = () => setLines((ls) => [...ls, { key: Math.max(-1, ...ls.map((l) => l.key)) + 1, label: "", quantity: "1", unit: "forfait", unitPrice: "" }]);
  const ht = lines.reduce((s, l) => s + n(l.quantity) * n(l.unitPrice), 0);
  const total = ht * (1 + n(vat) / 100);

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="table-wrap">
        <table className="quote-lines">
          <thead><tr><th>Désignation</th><th style={{ width: 90 }}>Qté</th><th style={{ width: 110 }}>Unité</th><th style={{ width: 150 }}>Prix unitaire HT</th><th className="num" style={{ width: 140 }}>Montant HT</th><th style={{ width: 40 }} /></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key}>
                <td><input name="line_label" value={l.label} onChange={(e) => set(l.key, { label: e.target.value })} placeholder="Ex. Esquisse et avant-projet sommaire" /></td>
                <td><input name="line_qty" inputMode="decimal" value={l.quantity} onChange={(e) => set(l.key, { quantity: e.target.value })} /></td>
                <td><input name="line_unit" value={l.unit} onChange={(e) => set(l.key, { unit: e.target.value })} placeholder="forfait, m², visite" /></td>
                <td><input name="line_price" inputMode="decimal" value={l.unitPrice} onChange={(e) => set(l.key, { unitPrice: e.target.value })} /></td>
                <td className="num">{fmt(n(l.quantity) * n(l.unitPrice))}</td>
                <td className="right">
                  {lines.length > 1 && (
                    <button type="button" className="btn btn-ghost btn-sm" aria-label="Retirer la ligne" style={{ padding: 4 }} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                      <Icon name="close" width={16} height={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <button type="button" className="btn btn-sm" onClick={add}><Icon name="plus" /> Ajouter une ligne</button>
        <dl className="kv quote-totals">
          <dt>Total HT</dt><dd className="num">{fmt(ht)}</dd>
          <dt>TVA <input name="vatRate" inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} style={{ width: 64, padding: "4px 8px", display: "inline-block" }} /> %</dt><dd className="num">{fmt(total - ht)}</dd>
          <dt><strong>Total TTC</strong></dt><dd className="num"><strong>{fmt(total)}</strong></dd>
        </dl>
      </div>
    </div>
  );
}
