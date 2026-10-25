import type { Quote, QuoteLine } from "@prisma/client";
import { Field } from "../ui";
import { Form } from "@/components/form";
import { QuoteLines } from "@/components/quote-lines";
import { inputDate, num } from "@/lib/format";

export function QuoteForm({
  quote, clients, defaultClient, vatRate, action, submit,
}: {
  quote?: (Quote & { lines: QuoteLine[] }) | null;
  clients: { id: string; name: string }[];
  defaultClient?: string;
  vatRate: number;
  action: (fd: FormData) => Promise<unknown>;
  submit: string;
}) {
  const validUntil = quote ? quote.validUntil : new Date(Date.now() + 30 * 86400000);
  return (
    <Form action={action} className="card form">
      <div className="form-grid">
        <Field label="Client *">
          <select name="clientId" required defaultValue={quote?.clientId ?? defaultClient ?? ""}>
            <option value="" disabled>Choisir un client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Objet *">
          <input name="object" required defaultValue={quote?.object ?? ""} placeholder="Ex. Mission complète, villa R+1 à Bouskoura" />
        </Field>
        <Field label="Date du devis"><input type="date" name="issueDate" defaultValue={inputDate(quote?.issueDate ?? new Date())} /></Field>
        <Field label="Valable jusqu'au"><input type="date" name="validUntil" defaultValue={inputDate(validUntil)} /></Field>
      </div>
      <h2 style={{ marginTop: 6 }}>Prestations</h2>
      <QuoteLines
        vatRate={quote ? num(quote.vatRate) : vatRate}
        initial={(quote?.lines ?? []).map((l) => ({ label: l.label, quantity: String(num(l.quantity)), unit: l.unit ?? "", unitPrice: String(num(l.unitPrice)) }))}
      />
      <Field label="Conditions et remarques" hint="Modalités de paiement, délais, exclusions… Elles figurent sur le devis imprimé.">
        <textarea name="notes" defaultValue={quote?.notes ?? ""} placeholder="Ex. Paiement selon l'échéancier : 20 % à la signature, puis à chaque phase." />
      </Field>
      <div className="form-actions"><button className="btn btn-primary">{submit}</button></div>
    </Form>
  );
}
