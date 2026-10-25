import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Topbar, PageHead } from "@/components/ui";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium" });

export default async function PlatformAdminPage() {
  await requirePlatformAdmin();
  const cabinets = await prisma.cabinet.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, projects: true, clients: true } },
      users: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, role: true, active: true } },
      projects: { orderBy: { createdAt: "desc" }, take: 3, select: { id: true, name: true, reference: true, status: true, createdAt: true } },
    },
  });
  const totals = cabinets.reduce((sum, cabinet) => ({
    users: sum.users + cabinet._count.users,
    projects: sum.projects + cabinet._count.projects,
    clients: sum.clients + cabinet._count.clients,
  }), { users: 0, projects: 0, clients: 0 });

  return (
    <>
      <Topbar crumbs={[{ label: "Administration plateforme" }]} />
      <div className="content">
        <PageHead title="Administration plateforme" subtitle="Vue globale des cabinets inscrits, de leurs équipes et de leur activité." />
        <div className="grid grid-4">
          <div className="stat"><div className="stat-label">Cabinets</div><div className="stat-value">{cabinets.length}</div><div className="stat-sub">Tous statuts confondus</div></div>
          <div className="stat"><div className="stat-label">Comptes utilisateurs</div><div className="stat-value">{totals.users}</div></div>
          <div className="stat"><div className="stat-label">Projets</div><div className="stat-value">{totals.projects}</div></div>
          <div className="stat"><div className="stat-label">Clients</div><div className="stat-value">{totals.clients}</div></div>
        </div>

        <div className="stack" style={{ marginTop: 18 }}>
          {cabinets.map((cabinet) => (
            <section className="card" key={cabinet.id}>
              <div className="card-head">
                <div>
                  <h2>{cabinet.name}</h2>
                  <div className="faint">{cabinet.slug} · créé le {dateFormatter.format(cabinet.createdAt)}</div>
                </div>
                <span className="badge">{cabinet.status} · {cabinet.plan}</span>
              </div>
              <dl className="grid grid-4">
                <div><dt className="stat-label">Contact</dt><dd>{cabinet.contactEmail || "—"}</dd></div>
                <div><dt className="stat-label">Téléphone</dt><dd>{cabinet.phone || "—"}</dd></div>
                <div><dt className="stat-label">Ville</dt><dd>{cabinet.city || "—"}</dd></div>
                <div><dt className="stat-label">Essai jusqu’au</dt><dd>{cabinet.trialEndsAt ? dateFormatter.format(cabinet.trialEndsAt) : "—"}</dd></div>
              </dl>
              <div className="grid grid-2" style={{ marginTop: 18 }}>
                <div>
                  <h3>Équipe ({cabinet.users.length})</h3>
                  {cabinet.users.length === 0 ? <p className="faint">Aucun compte.</p> : (
                    <div className="table-wrap"><table><thead><tr><th>Nom</th><th>E-mail</th><th>Profil</th><th>État</th></tr></thead>
                      <tbody>{cabinet.users.map((member) => <tr key={member.id}><td>{member.name}</td><td>{member.email}</td><td>{member.role}</td><td>{member.active ? "Actif" : "Désactivé"}</td></tr>)}</tbody>
                    </table></div>
                  )}
                </div>
                <div>
                  <h3>Projets récents ({cabinet._count.projects})</h3>
                  {cabinet.projects.length === 0 ? <p className="faint">Aucun projet.</p> : (
                    <div className="table-wrap"><table><thead><tr><th>Référence</th><th>Projet</th><th>État</th></tr></thead>
                      <tbody>{cabinet.projects.map((project) => <tr key={project.id}><td>{project.reference}</td><td>{project.name}</td><td>{project.status}</td></tr>)}</tbody>
                    </table></div>
                  )}
                </div>
              </div>
            </section>
          ))}
          {cabinets.length === 0 && <div className="card"><p className="muted">Aucun cabinet n’est encore inscrit.</p></div>}
        </div>
      </div>
    </>
  );
}
