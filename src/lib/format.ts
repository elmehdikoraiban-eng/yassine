import { Prisma } from "@prisma/client";

type Num = number | string | Prisma.Decimal | null | undefined;

export const num = (v: Num): number => (v == null ? 0 : Number(v));

const mad = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (v: Num) => `${mad.format(num(v))} MAD`;

export const round2 = (n: number) => Math.round(n * 100) / 100;

// Les serveurs tournent en UTC : on affiche toujours l'heure du Maroc.
const TZ = "Africa/Casablanca";

export const date = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }) : "—";

export const dateTime = (d: Date | string | null | undefined) =>
  d
    ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ })
    : "—";

export const inputDate = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export const fileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/** Lit un champ de formulaire texte, en renvoyant null s'il est vide. */
export const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
};

export const decimalOrNull = (fd: FormData, key: string) => {
  const v = str(fd, key);
  if (v == null) return null;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
