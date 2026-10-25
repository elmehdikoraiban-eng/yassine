"use client";

import { useState } from "react";
import type { Client } from "@prisma/client";
import { Field } from "../ui";
import { inputDate } from "@/lib/format";
import { Form } from "@/components/form";

export function ClientForm({ client, action, submit }: { client?: Client | null; action: (fd: FormData) => Promise<unknown>; submit: string }) {
  const [type, setType] = useState<Client["type"]>(client?.type ?? "PHYSIQUE");
  const physical = type === "PHYSIQUE";
  const company = type === "MORALE";

  return (
    <Form action={action} className="card form">
      <div className="notice" style={{ flexBasis: "100%" }}>
        Les informations d’identification du client sont obligatoires : CIN et identité familiale pour une personne physique ; ICE, RC et IF pour une personne morale.
      </div>
      <div className="form-grid">
        <Field label="Type *">
          <select name="type" required value={type} onChange={(event) => setType(event.target.value as Client["type"])}>
            <option value="PHYSIQUE">Personne physique</option>
            <option value="MORALE">Personne morale</option>
          </select>
        </Field>
        <Field label="Nom ou raison sociale *">
          <input name="name" required defaultValue={client?.name ?? ""} />
        </Field>
        <Field label={company ? "Interlocuteur *" : "Interlocuteur"}>
          <input name="contact" required={company} defaultValue={client?.contact ?? ""} />
        </Field>
        <Field label={physical ? "N° CIN *" : "N° CIN"}>
          <input name="cin" required={physical} defaultValue={client?.cin ?? ""} />
        </Field>
        <Field label={physical ? "Date d’expiration CIN *" : "Date d’expiration CIN"}>
          <input name="cinExpiryDate" type="date" required={physical} defaultValue={inputDate(client?.cinExpiryDate)} />
        </Field>
        <Field label={physical ? "Nom du père *" : "Nom du père"}>
          <input name="fatherName" required={physical} defaultValue={client?.fatherName ?? ""} />
        </Field>
        <Field label={physical ? "Nom de la mère *" : "Nom de la mère"}>
          <input name="motherName" required={physical} defaultValue={client?.motherName ?? ""} />
        </Field>
        <Field label={company ? "ICE *" : "ICE"}>
          <input name="ice" required={company} defaultValue={client?.ice ?? ""} />
        </Field>
        <Field label={company ? "RC *" : "RC"}>
          <input name="rc" required={company} defaultValue={client?.rc ?? ""} />
        </Field>
        <Field label={company ? "IF (identifiant fiscal) *" : "IF (identifiant fiscal)"}>
          <input name="ifiscal" required={company} defaultValue={client?.ifiscal ?? ""} />
        </Field>
        <Field label="Téléphone *">
          <input name="phone" type="tel" required defaultValue={client?.phone ?? ""} />
        </Field>
        <Field label="E-mail">
          <input name="email" type="email" defaultValue={client?.email ?? ""} />
        </Field>
        <Field label="Ville *">
          <input name="city" required defaultValue={client?.city ?? ""} />
        </Field>
        <Field label="Adresse *" full>
          <input name="address" required defaultValue={client?.address ?? ""} />
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

