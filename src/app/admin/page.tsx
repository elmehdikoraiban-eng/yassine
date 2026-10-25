import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Topbar, PageHead } from "@/components/ui";
import { CabinetControls } from "@/components/admin/cabinet-controls";
import { date, dateTime, fileSize } from "@/lib/format";

export const dynamic = "force-dynamic";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export default async function PlatformAdminPage() {
  await requirePlatformAdmin();
  const now = new Date();
  const [cabinets, activeUsers, activeProjects, recentRegistrations, documentBytes, stakeholderBytes, activity, actions] = await Promise.all([
    prisma.cabinet.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true, projects: true, clients: true } },
        users: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true } },
      },
    }),
    prisma.user.count({ where: { active: true } }),
    prisma.project.count({ where: { status: { in: ["EN_COURS", "SUSPENDU"] } } }),
    prisma.cabinet.count({ where: { createdAt: { gte: new Date(now.getTime() - THIRTY_DAYS) } } }),
    prisma.documentVersion.groupBy({ by: ["cabinetId"], _sum: { size: true } }),
    prisma.stakeholderFile.groupBy({ by: ["cabinetId"], _sum: { size: true } }),
    prisma.auditLog.groupBy({ by: ["cabinetId"], _max: { createdAt: true } }),
    prisma.platformAdminAction.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  const documentSize = new Map(documentBytes.filter((row) => row.cabinetId).map((row) => [row.cabinetId!, row._sum.size ?? 0]));
  const stakeholderSize = new Map(stakeholderBytes.filter((row) => row.cabinetId).map((row) => [row.cabinetId!, row._sum.size ?? 0]));
  const lastActivity = new Map(activity.filter((row) => row.cabinetId).map((row) => [row.cabinetId!, row._max.createdAt]));

  const totals = cabinets.reduce((sum, cabinet) => ({
    users: sum.users + cabinet._count.users,
    projects: sum.projects + cabinet._count.projects,
    clients: sum.clients + cabinet._count.clients,
    activeCabinets: sum.activeCabinets + Number(cabinet.status === "ACTIVE"),
    overdue: sum.overdue + Number(cabinet.subscriptionStatus === "PAST_DUE"),
    trials: sum.trials + Number(cabinet.subscriptionStatus === "TRIAL"),
  }), { users: 0, projects: 0, clients: 0, activeCabinets: 0, overdue: 0, trials: 0 });

  return (
    <>
      <Topbar crumbs={[{ label: "Administration plateforme" }]} />
      <div className="content">
        <PageHead title="Administration plateforme" subtitle="Cabinets, comptes, activité et suivi manuel des abonnements." />
        <div className="grid grid-4">
          <div className="stat"><div className="stat-label">Cabinets actifs</div><div className="stat-value">{totals.activeCabinets}</div><div className="stat-sub">{cabinets.length} au total</div></div>
          <div className="stat"><div className="stat-label">Comptes actifs</div><div className="stat-value">{activeUsers}</div><div className="stat-sub">{totals.users} au total</div></div>
          <div className="stat"><div className="stat-label">Projets en cours</div><div className="stat-value">{activeProjects}</div><div className="stat-sub">{totals.projects} au total</div></div>
          <div className="stat"><div className="stat-label">Nouveaux cabinets · 30 jours</div><div className="stat-value">{recentRegistrations}</div><div className="stat-sub">{totals.trials} essais · {totals.overdue} paiements en retard</div></div>
        </div>

        <div className="stack" style={{ marginTop: 18 }}>
          {cabinets.map((cabinet) => {
            const auditDate = lastActivity.get(cabinet.id);
            const latestLogin = cabinet.users.reduce<Date | null>((latest, member) => member.lastLoginAt && (!latest || member.lastLoginAt > latest) ? member.lastLoginAt : latest, null);
            const latestActivity = [auditDate, latestLogin, cabinet.createdAt].filter((value): value is Date => Boolean(value)).reduce((latest, value) => value > latest ? value : latest, cabinet.createdAt);
            const storage = (documentSize.get(cabinet.id) ?? 0) + (stakeholderSize.get(cabinet.id) ?? 0);
            return (
              <section className="card" key={cabinet.id}>
                <div className="card-head">
                  <div>
                    <h2>{cabinet.name}</h2>
                    <div className="faint">{cabinet.slug} · créé le {date(cabinet.createdAt)}</div>
                  </div>
                  <span className="badge">{cabinet.status} · {cabinet.plan} · {cabinet.subscriptionStatus}</span>
                </div>
                <dl className="grid grid-4">
                  <div><dt className="stat-label">Contact</dt><dd>{cabinet.contactEmail || "—"}</dd></div>
                  <div><dt className="stat-label">Téléphone</dt><dd>{cabinet.phone || "—"}</dd></div>
                  <div><dt className="stat-label">Ville</dt><dd>{cabinet.city || "—"}</dd></div>
                  <div><dt className="stat-label">Inscription</dt><dd>{date(cabinet.createdAt)}</dd></div>
                  <div><dt className="stat-label">Essai jusqu’au</dt><dd>{date(cabinet.trialEndsAt)}</dd></div>
                  <div><dt className="stat-label">Renouvellement</dt><dd>{date(cabinet.subscriptionRenewsAt)}</dd></div>
                  <div><dt className="stat-label">Dernier paiement</dt><dd>{date(cabinet.lastPaymentAt)}</dd></div>
                  <div><dt className="stat-label">Dernière activité</dt><dd>{dateTime(latestActivity)}</dd></div>
                  <div><dt className="stat-label">Stockage utilisé</dt><dd>{fileSize(storage)}</dd></div>
                  <div><dt className="stat-label">Clients enregistrés</dt><dd>{cabinet._count.clients}</dd></div>
                  <div><dt className="stat-label">Projets suivis</dt><dd>{cabinet._count.projects}</dd></div>
                  <div><dt className="stat-label">Début abonnement</dt><dd>{date(cabinet.subscriptionStartedAt)}</dd></div>
                </dl>

                <div className="grid grid-2" style={{ marginTop: 18 }}>
                  <div>
                    <h3>Équipe ({cabinet._count.users})</h3>
                    {cabinet.users.length === 0 ? <p className="faint">Aucun compte.</p> : (
                      <div className="table-wrap"><table><thead><tr><th>Nom</th><th>E-mail</th><th>Profil</th><th>État</th><th>Dernière connexion</th></tr></thead>
                        <tbody>{cabinet.users.map((member) => <tr key={member.id}><td>{member.name}</td><td>{member.email}</td><td>{member.role}</td><td>{member.active ? "Actif" : "Désactivé"}</td><td>{dateTime(member.lastLoginAt)}</td></tr>)}</tbody>
                      </table></div>
                    )}
                  </div>
                  <div>
                    <h3>Activité projet</h3>
                    <p className="muted">{cabinet._count.projects} projets au total.</p>
                    <p className="faint">Seuls les volumes et l’activité sont visibles ici ; les dossiers et documents restent privés.</p>
                  </div>
                </div>
                <CabinetControls cabinet={{
                  id: cabinet.id, status: cabinet.status, plan: cabinet.plan, subscriptionStatus: cabinet.subscriptionStatus,
                  trialEndsAt: cabinet.trialEndsAt, subscriptionStartedAt: cabinet.subscriptionStartedAt,
                  subscriptionRenewsAt: cabinet.subscriptionRenewsAt, lastPaymentAt: cabinet.lastPaymentAt,
                }} />
              </section>
            );
          })}
          {cabinets.length === 0 && <div className="card"><p className="muted">Aucun cabinet n’est encore inscrit.</p></div>}
        </div>

        <section className="card" style={{ marginTop: 24 }}>
          <h2>Historique des actions admin</h2>
          {actions.length === 0 ? <p className="faint">Aucune action admin enregistrée pour l’instant.</p> : (
            <div className="table-wrap"><table><thead><tr><th>Date</th><th>Admin</th><th>Cabinet</th><th>Action</th></tr></thead>
              <tbody>{actions.map((item) => <tr key={item.id}><td>{dateTime(item.createdAt)}</td><td>{item.adminEmail}</td><td>{item.cabinetId || "—"}</td><td>{item.summary}</td></tr>)}</tbody>
            </table></div>
          )}
        </section>
      </div>
    </>
  );
}

