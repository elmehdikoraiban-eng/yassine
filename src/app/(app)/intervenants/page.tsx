import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can, projectScope } from "@/lib/permissions";
import { STAKEHOLDER_KIND_LABELS } from "@/lib/constants";
import { Topbar, PageHead, Badge, Empty, Field } from "@/components/ui";
import { createStakeholderForm } from "@/app/actions/projects";
import { Form } from "@/components/form";

export default async function StakeholdersPage() {
  const user = await requireUser();
  const list = await prisma.stakeholder.findMany({
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    include: { projects: { where: { project: projectScope(user) }, include: { project: { select: { id: true, reference: true, name: true } } } } },
  });
  return (
    <>
      <Topbar crumbs={[{ label: "Intervenants" }]} />
      <div className="content">
        <PageHead title="Intervenants" subtitle="BET, entreprises, bureaux de contrôle, laboratoires et partenaires." />
        <div className="split">
          <div className="card card-flush">
            {list.length === 0 ? <Empty>Aucun intervenant.</Empty> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Type</th><th>Nom</th><th>Contact</th><th>Projets</th></tr></thead>
                  <tbody>
                    {list.map((s) => (
                      <tr key={s.id}>
                        <td><Badge plain>{STAKEHOLDER_KIND_LABELS[s.kind]}</Badge></td>
                        <td>{s.name}</td>
                        <td className="muted" style={{ fontSize: 13 }}>{[s.contact, s.phone, s.email].filter(Boolean).join(" · ") || "—"}</td>
                        <td style={{ fontSize: 13 }}>
                          {s.projects.map((l) => (
                            <Link key={l.projectId} className="link" href={`/projets/${l.projectId}/intervenants`} style={{ marginRight: 8 }}>{l.project.reference}</Link>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {can(user, "manageStakeholders") && (
            <Form action={createStakeholderForm} className="card form">
              <h2>Nouvel intervenant</h2>
              <Field label="Type">
                <select name="kind" defaultValue="BET">
                  {Object.entries(STAKEHOLDER_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Nom *"><input name="name" required /></Field>
              <Field label="Interlocuteur"><input name="contact" /></Field>
              <Field label="Téléphone"><input name="phone" /></Field>
              <Field label="E-mail"><input name="email" type="email" /></Field>
              <button className="btn btn-primary">Ajouter</button>
            </Form>
          )}
        </div>
      </div>
    </>
  );
}
