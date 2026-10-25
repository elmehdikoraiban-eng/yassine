"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

type Latest = { id: string; title: string; body: string | null; href: string | null } | null;

/** Lien « Notifications » du menu, avec compteur mis à jour toutes les 30 s et bulle pour chaque nouveauté. */
export function NotifBell({ initial }: { initial: number }) {
  const path = usePathname();
  const [unread, setUnread] = useState(initial);
  const [toast, setToast] = useState<Latest>(null);
  const seen = useRef<string | null>(null);
  const first = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (!r.ok) return;
      const d: { unread: number; latest: Latest } = await r.json();
      setUnread(d.unread);
      // Bulle seulement pour une notification arrivée pendant la session, pas au chargement.
      if (d.latest && d.latest.id !== seen.current && !first.current) setToast(d.latest);
      seen.current = d.latest?.id ?? seen.current;
      first.current = false;
    } catch {}
  }, []);

  useEffect(() => {
    if (path === "/notifications") setToast(null);
    refresh();
  }, [path, refresh]);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 30000);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  const active = path === "/notifications";
  return (
    <>
      <Link href="/notifications" className={`nav-item${active ? " active" : ""}`}>
        <Icon name="bell" /> Notifications
        {unread > 0 && !active && <span className="nav-count">{unread > 99 ? "99+" : unread}</span>}
      </Link>
      {toast && (
        <div className="toast" role="status">
          <Icon name="bell" width={18} height={18} style={{ flexShrink: 0, marginTop: 2, color: "var(--accent)" }} />
          <Link href={toast.href || "/notifications"} className="grow" onClick={() => setToast(null)}>
            <strong style={{ display: "block", fontSize: 14 }}>{toast.title}</strong>
            {toast.body && <p className="muted">{toast.body}</p>}
          </Link>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Fermer" onClick={() => setToast(null)} style={{ padding: 4 }}>
            <Icon name="close" width={16} height={16} />
          </button>
        </div>
      )}
    </>
  );
}
