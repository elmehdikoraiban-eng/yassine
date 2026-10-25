import type { Project } from "@prisma/client";
import { Field } from "../ui";
import { Form } from "@/components/form";

export function ProjectForm({
  project, clients, users, defaultClient, action, submit,
}: {
  project?: Project | null;
  clients: { id: string; name: string }[];
  users?: { id: string; name: string; role: string }[];
  defaultClient?: string;
  action: (fd: FormData) => Promise<unknown>;
  submit: string;
}) {
  return (
    <Form action={action} className="card form">
      <div className="form-grid">
        <Field label="Désignation du projet *" full>
          <input name="name" required defaultValue={project?.name ?? ""} placeholder="Ex. Villa R+1, lotissement Al Manar" />
        </Field>
        <Field label="Client *">
          <select name="clientId" required defaultValue={project?.clientId ?? defaultClient ?? ""}>
            <option value="" disabled>Choisir un client</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Nature">
          <input name="nature" defaultValue={project?.nature ?? ""} placeholder="Villa, immeuble, équipement, réhabilitation…" />
        </Field>
        <Field label="Localisation">
          <input name="location" defaultValue={project?.location ?? ""} placeholder="Quartier, lot, adresse" />
        </Field>
        <Field label="Ville">
          <input name="city" defaultValue={project?.city ?? ""} />
        </Field>
        <Field label="Titre foncier">
          <input name="landTitle" defaultValue={project?.landTitle ?? ""} />
        </Field>
        <Field label="Surface du terrain (m²)">
          <input name="surfaceTerrain" inputMode="decimal" defaultValue={project?.surfaceTerrain?.toString() ?? ""} />
        </Field>
        <Field label="Surface construite (m²)">
          <input name="surfaceConstruite" inputMode="decimal" defaultValue={project?.surfaceConstruite?.toString() ?? ""} />
        </Field>
        <Field label="Programme" full>
          <textarea name="programme" defaultValue={project?.programme ?? ""} placeholder="Besoins du client, niveaux, locaux…" />
        </Field>
        {users && (
          <div className="field full">
            <span>Équipe affectée</span>
            <div className="row" style={{ gap: 14 }}>
              {users.map((u) => (
                <label key={u.id} className="check">
                  <input type="checkbox" name="members" value={u.id} /> {u.name}
                </label>
              ))}
            </div>
            <span className="hint">Chaque personne cochée reçoit une notification. Les techniciens et collaborateurs ne voient que les projets où ils sont affectés.</span>
          </div>
        )}
        {users && (
          <Field label="Consigne pour l'équipe" full hint="Facultatif : transmise avec la notification d'affectation.">
            <textarea name="instructions" placeholder="Ex. Préparer le relevé du terrain avant jeudi, puis l'esquisse." />
          </Field>
        )}
      </div>
      <div className="form-actions"><button className="btn btn-primary">{submit}</button></div>
    </Form>
  );
}
