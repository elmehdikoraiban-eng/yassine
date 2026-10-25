import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can, MATRIX_TABLE } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/format";
import { Topbar, PageHead, Field } from "@/components/ui";
import { createUser, updateUser } from "@/app/actions/admin";
import { Form } from "@/components/form";

const PERM_LABELS: Record<string, string> = {
  seeAllProjects: "Voir tous les projets (sinon : projets affectés)",
  manageProjects: "Créer et modifier les projets, changer d'étape",
  seeClients: "Consulter les fiches clients",
  manageClients: "Créer et modifier les clients",
  manageStakeholders: "Gérer les intervenants",
  uploadDocuments: "Déposer des documents et versions",
  changePlanStatus: "Changer l'état d'un plan, classer, rendre obsolète",
  validateDocuments: "Valider un document ou un plan",
  distributeDocuments: "Enregistrer une diffusion aux tiers",
  seeFinance: "Voir honoraires, factures et règlements",
  manageFinance: "Préparer, émettre les factures, saisir les règlements",
  cancelInvoice: "Annuler une facture, supprimer un règlement",
  manageUsers: "Gérer les comptes et les paramètres",
  seeAudit: "Consulter le journal global",
};

export default async function TeamPage() {
  const user = await requireUser();
  if (!can(user, "manageUsers")) notFound();
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { _count: { select: { memberships: true } } } });
  const roles = Object.keys(ROLE_LABELS);

  return (
    <>
      <Topbar crumbs={[{ label: "Équipe et droits" }]} />
      <div className="content">
        <PageHead title="Équipe et droits" subtitle="Comptes du cabinet et matrice des autorisations par profil." />
        <div className="split">
          <div className="card card-flush">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Personne</th><th>Profil</th><th>Actif</th><th>Nouveau mot de passe</th><th /></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                          <span className="avatar">{initials(u.name)}</span>
                          <span>{u.name}<div className="faint" style={{ fontSize: 12 }}>{u.email} · {u._count.memberships} projet(s)</div></span>
                        </div>
                      </td>
                      <td colSpan={4}>
                        <Form action={updateUser.bind(null, u.id)} className="inline-form" style={{ flexWrap: "nowrap" }}>
                          <select name="role" defaultValue={u.role}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
                          <input type="checkbox" name="active" defaultChecked={u.active} aria-label="Actif" />
                          <input name="password" type="password" placeholder="Inchangé" style={{ width: 140 }} />
                          <button className="btn btn-sm">Enregistrer</button>
                        </Form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Form action={createUser} className="card form">
            <h2>Nouveau compte</h2>
            <Field label="Nom complet"><input name="name" required /></Field>
            <Field label="E-mail"><input name="email" type="email" required /></Field>
            <Field label="Profil">
              <select name="role" defaultValue="TECHNICIEN">{roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
            </Field>
            <Field label="Mot de passe provisoire" hint="8 caractères minimum."><input name="password" type="password" required minLength={8} /></Field>
            <button className="btn btn-primary">Créer le compte</button>
          </Form>
        </div>

        <div className="card card-flush" style={{ marginTop: 16 }}>
          <div className="card-head"><h2>Matrice des droits</h2><span className="faint">Proposition par défaut, à valider avec le cabinet</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Action</th>{roles.map((r) => <th key={r} style={{ textAlign: "center" }}>{ROLE_LABELS[r]}</th>)}</tr></thead>
              <tbody>
                {Object.entries(MATRIX_TABLE).map(([perm, allowed]) => (
                  <tr key={perm}>
                    <td>{PERM_LABELS[perm] ?? perm}</td>
                    {roles.map((r) => (
                      <td key={r} style={{ textAlign: "center", color: (allowed as string[]).includes(r) ? "var(--accent)" : "var(--text-3)" }}>
                        {(allowed as string[]).includes(r) ? "✓" : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
