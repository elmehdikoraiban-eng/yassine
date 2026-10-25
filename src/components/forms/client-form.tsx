import type { Client } from "@prisma/client";
import { Field } from "../ui";
import { Form } from "@/components/form";

export function ClientForm({ client, action, submit }: { client?: Client | null; action: (fd: FormData) => Promise<unknown>; submit: string }) {
  return (
    <Form action={action} className="card form">
      <div className="form-grid">
        <Field label="Type">
          <select name="type" defaultValue={client?.type ?? "PHYSIQUE"}>
            <option value="PHYSIQUE">Personne physique</option>
            <option value="MORALE">Personne morale</option>
          </select>
        </Field>
        <Field label="Nom ou raison sociale *">
          <input name="name" required defaultValue={client?.name ?? ""} />
        </Field>
        <Field label="Interlocuteur (personne morale)">
          <input name="contact" defaultValue={client?.contact ?? ""} />
        </Field>
        <Field label="CIN">
          <input name="cin" defaultValue={client?.cin ?? ""} />
        </Field>
        <Field label="ICE" hint="Identifiant commun de l'entreprise, repris sur les factures.">
          <input name="ice" defaultValue={client?.ice ?? ""} />
        </Field>
        <Field label="RC">
          <input name="rc" defaultValue={client?.rc ?? ""} />
        </Field>
        <Field label="IF (identifiant fiscal)">
          <input name="ifiscal" defaultValue={client?.ifiscal ?? ""} />
        </Field>
        <Field label="Téléphone">
          <input name="phone" defaultValue={client?.phone ?? ""} />
        </Field>
        <Field label="E-mail">
          <input name="email" type="email" defaultValue={client?.email ?? ""} />
        </Field>
        <Field label="Ville">
          <input name="city" defaultValue={client?.city ?? ""} />
        </Field>
        <Field label="Adresse" full>
          <input name="address" defaultValue={client?.address ?? ""} />
        </Field>
        <Field label="Observations" full>
          <textarea name="notes" defaultValue={client?.notes ?? ""} />
        </Field>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary">{submit}</button>
      </div>
    </Form>
  );
}
