import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { initials } from "@/lib/format";
import { Icon } from "@/components/icons";
import { NavLink } from "@/components/nav-link";
import { NavBackdrop } from "@/components/mobile-nav";
import { logout } from "../actions/auth";

export default async function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();

  return (
    <div className="app">
      <aside className="sidebar">
        <Link href="/admin" className="brand">
          <span className="brand-mark">Y</span>
          <span className="brand-name">Administration</span>
        </Link>
        <nav className="nav-section">
          <NavLink href="/admin"><Icon name="shield" /> Vue générale</NavLink>
        </nav>
        <div className="sidebar-foot">
          <form action={logout}>
            <button className="user-chip btn-ghost" style={{ width: "100%", border: "none", background: "none", font: "inherit", color: "inherit", cursor: "pointer", textAlign: "left" }} title="Se déconnecter">
              <span className="avatar">{initials(admin.name)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 500 }}>{admin.name}</span>
                <span className="faint" style={{ fontSize: 12 }}>{admin.email}</span>
              </span>
              <Icon name="logout" width={16} height={16} />
            </button>
          </form>
        </div>
      </aside>
      <NavBackdrop />
      <main className="main">{children}</main>
    </div>
  );
}
