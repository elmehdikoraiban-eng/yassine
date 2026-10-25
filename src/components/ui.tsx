import Link from "next/link";
import { MenuButton } from "./mobile-nav";

export function Topbar({ crumbs, actions }: { crumbs: { href?: string; label: string }[]; actions?: React.ReactNode }) {
  return (
    <div className="topbar">
      <MenuButton />
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} className="row" style={{ gap: 6 }}>
            {i > 0 && <span className="faint">/</span>}
            {c.href ? <Link href={c.href}>{c.label}</Link> : <span style={{ color: "var(--text)" }}>{c.label}</span>}
          </span>
        ))}
      </div>
      <div className="spacer" />
      {actions}
    </div>
  );
}

export function PageHead({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function Badge({ tone = "neutral", children, plain }: { tone?: string; children: React.ReactNode; plain?: boolean }) {
  return <span className={`badge tone-${tone}${plain ? " plain" : ""}`}>{children}</span>;
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Field({ label, children, full, hint }: { label: string; children: React.ReactNode; full?: boolean; hint?: string }) {
  return (
    <label className={`field${full ? " full" : ""}`}>
      {label}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}
