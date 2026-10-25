import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { STAKEHOLDER_KIND_LABELS } from "@/lib/constants";
import { Badge, Empty, Field } from "@/components/ui";
import { linkStakeholder, unlinkStakeholder } from "@/app/actions/projects";
import { Form } from "@/components/form";

export default async function ProjectStakeholders({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [links, all] = await Promise.all([
    prisma.projectStakeholder.findMany({ where: { projectId: id }, include: { stakeholder: true }, orderBy: { stakeholder: { kind: "asc" } } }),
    prisma.stakeholder.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] }),
  ]);
  const manage = can(user, "manageStakeholders");
  const linked = new Set(links.map((l) => l.stakeholderId));

  return (
    <div className="split">
      <div className="card card-flush">
        <div className="card-head"><h2>Intervenants du projet</h2></div>
        {links.length === 0 ? (
          <Empty>Aucun intervenant associé (BET, entreprise, bureau de contrôle…).</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Type</th><th>Nom</th><th>Mission</th><th>Contact</th><th /></tr></thead>
              <tbody>
                {links.map(({ stakeholder: s, mission }) => (
                  <tr key={s.id}>
                    <td><Badge plain>{STAKEHOLDER_KIND_LABELS[s.kind]}</Badge></td>
                    <td>{s.name}</td>
                    <td className="muted">{mission ?? "—"}</td>
                    <td className="muted" style={{ fontSize: 13 }}>{[s.contact, s.phone, s.email].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="right">
                      {manage && (
                        <Form action={unlinkStakeholder.bind(null, id, s.id)}>
                          <button className="btn btn-ghost btn-sm">Retirer</button>
                        </Form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {manage && (
        <Form action={linkStakeholder.bind(null, id)} className="card form">
          <h2>Associer un intervenant</h2>
          <Field label="Intervenant existant">
            <select name="stakeholderId" defaultValue="__new">
              <option value="__new">— Nouvel intervenant (remplir ci-dessous) —</option>
              {all.filter((s) => !linked.has(s.id)).map((s) => (
                <option key={s.id} value={s.id}>{STAKEHOLDER_KIND_LABELS[s.kind]} · {s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Mission sur ce projet"><input name="mission" placeholder="Ex. béton armé, gros œuvre, contrôle technique" /></Field>
          <details className="disclosure">
            <summary className="hint">Nouvel intervenant : type, nom, coordonnées</summary>
            <div className="form">
              <Field label="Type">
                <select name="kind" defaultValue="BET">
                  {Object.entries(STAKEHOLDER_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Nom"><input name="name" /></Field>
              <Field label="Interlocuteur"><input name="contact" /></Field>
              <Field label="Téléphone"><input name="phone" /></Field>
              <Field label="E-mail"><input name="email" type="email" /></Field>
            </div>
          </details>
          <button className="btn btn-primary">Associer</button>
        </Form>
      )}
    </div>
  );
}
