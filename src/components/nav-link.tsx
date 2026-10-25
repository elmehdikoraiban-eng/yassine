"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children, className = "nav-item" }: { href: string; children: React.ReactNode; className?: string }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} className={`${className}${active ? " active" : ""}`}>
      {children}
    </Link>
  );
}

export function Tab({ href, children, exact }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} className={`tab${active ? " active" : ""}`}>
      {children}
    </Link>
  );
}
