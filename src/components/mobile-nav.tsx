"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "./icons";

// Bouton ☰ : sur téléphone il ouvre le menu latéral (refermé au changement de page, par un appui
// à côté ou par Échap) ; sur ordinateur il masque ou réaffiche le menu, choix mémorisé.
const root = () => document.documentElement;
const isMobile = () => window.matchMedia("(max-width: 760px)").matches;

function toggle() {
  if (isMobile()) return root().classList.toggle("nav-open");
  const collapsed = root().classList.toggle("nav-collapsed");
  try { localStorage.setItem("nav-collapsed", collapsed ? "1" : ""); } catch {}
}

export function MenuButton() {
  return (
    <button type="button" className="btn btn-ghost btn-sm menu-toggle" aria-label="Afficher ou masquer le menu" onClick={toggle}>
      <Icon name="menu" />
    </button>
  );
}

export function NavBackdrop() {
  const path = usePathname();
  useEffect(() => { root().classList.remove("nav-open"); }, [path]);
  useEffect(() => {
    try { if (localStorage.getItem("nav-collapsed")) root().classList.add("nav-collapsed"); } catch {}
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && root().classList.remove("nav-open");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return <div className="nav-backdrop no-print" aria-hidden onClick={() => root().classList.remove("nav-open")} />;
}
