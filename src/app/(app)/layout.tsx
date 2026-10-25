import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can, projectScope } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/format";
import { Icon } from "@/components/icons";
import { NavLink } from "@/components/nav-link";
import { NotifBell } from "@/components/notif-bell";
import { NavBackdrop } from "@/components/mobile-nav";
import { getBrand } from "@/lib/brand";
import { logout } from "../actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [recent, brand, unread] = await Promise.all([
    prisma.project.findMany({
      where: { ...projectScope(user), status: { in: ["EN_COURS", "SUSPENDU"] } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, name: true, reference: true },
    }),
    getBrand(),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return (
    <>
      <div className="app">
        <aside className="sidebar">
          <Link href="/" className="brand">
            {brand.showMark && (brand.logo
              ? <img src={brand.logo} alt="" className="brand-logo" />
              : <span className="brand-mark">{brand.name.trim()[0]?.toUpperCase()}</span>)}
            <span className="brand-name">{brand.name}</span>
          </Link>
          {can(user, "manageProjects") && (
            <Link href="/projets/nouveau" className="new-btn">
              <Icon name="edit" /> Nouveau projet
            </Link>
          )}
          <NavLink href="/recherche"><Icon name="search" /> Rechercher</NavLink>
          <NotifBell initial={unread} />

          <nav className="nav-section">
            <NavLink href="/"><Icon name="home" /> Tableau de bord</NavLink>
            {can(user, "seeClients") && <NavLink href="/clients"><Icon name="users" /> Clients</NavLink>}
            <NavLink href="/projets"><Icon name="folder" /> Projets</NavLink>
            <NavLink href="/intervenants"><Icon name="briefcase" /> Intervenants</NavLink>
            {can(user, "seeFinance") && <NavLink href="/devis"><Icon name="file" /> Devis</NavLink>}
            {can(user, "seeFinance") && <NavLink href="/factures"><Icon name="receipt" /> Factures</NavLink>}
          </nav>

          {recent.length > 0 && (
            <nav className="nav-section">
              <div className="nav-title">Projets en cours</div>
              {recent.map((p) => (
                <NavLink key={p.id} href={`/projets/${p.id}`}>
                  <span className="nav-recent" title={`${p.reference} · ${p.name}`}>{p.name}</span>
                </NavLink>
              ))}
            </nav>
          )}

          {can(user, "manageUsers") && (
            <nav className="nav-section">
              <div className="nav-title">Administration</div>
              <NavLink href="/equipe"><Icon name="shield" /> Équipe et droits</NavLink>
              <NavLink href="/journal"><Icon name="history" /> Journal</NavLink>
              <NavLink href="/parametres"><Icon name="settings" /> Paramètres</NavLink>
            </nav>
          )}

          <div className="sidebar-foot">
            <form action={logout}>
              <button className="user-chip btn-ghost" style={{ width: "100%", border: "none", background: "none", font: "inherit", color: "inherit", cursor: "pointer", textAlign: "left" }} title="Se déconnecter">
                <span className="avatar">{initials(user.name)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 500 }}>{user.name}</span>
                  <span className="faint" style={{ fontSize: 12 }}>{ROLE_LABELS[user.role]}</span>
                </span>
                <Icon name="logout" width={16} height={16} />
              </button>
            </form>
          </div>
        </aside>
        <NavBackdrop />
        <main className="main">{children}</main>
      </div>
    </>
  );
}
