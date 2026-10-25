import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can, projectScope } from "@/lib/permissions";
import { PHASES, PROJECT_STATUS_LABELS, stepLabel, stepPhase, STEPS } from "@/lib/constants";
import { Topbar, PageHead, Empty, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { Prisma } from "@prisma/client";

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string; statut?: string; phase?: string }> }) {
  const user = await requireUser();
  const { q, statut = "EN_COURS", phase } = await searchParams;
  const where: Prisma.ProjectWhereInput = { ...projectScope(user) };
  if (statut !== "TOUS") where.status = statut as Prisma.EnumProjectStatusFilter["equals"];
  if (phase) where.step = { in: STEPS.filter((s) => s.phase === phase).map((s) => s.n) };
  if (q)
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { reference: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
      { client: { name: { contains: q, mode: "insensitive" } } },
    ];
  const projects = await prisma.project.findMany({ where, orderBy: { createdAt: "desc" }, include: { client: { select: { name: true } } } });

  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q, statut, phase, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    return `/projets?${p}`;
  };

  return (
    <>
      <Topbar crumbs={[{ label: "Projets" }]} />
      <div className="content">
        <PageHead
          title="Projets"
          subtitle="Du premier contact au permis d'habiter, en 20 étapes."
          actions={can(user, "manageProjects") && <Link href="/projets/nouveau" className="btn btn-primary"><Icon name="plus" /> Nouveau projet</Link>}
        />
        <form className="composer" style={{ marginBottom: 12 }}>
          <Icon name="search" width={18} height={18} className="faint" />
          <input name="q" defaultValue={q} placeholder="Référence, désignation, client ou ville" />
          <input type="hidden" name="statut" value={statut} />
          {phase && <input type="hidden" name="phase" value={phase} />}
        </form>
        <div className="row" style={{ marginBottom: 16 }}>
          {[["EN_COURS", "En cours"], ["SUSPENDU", "Suspendus"], ["CLOTURE", "Clôturés"], ["ARCHIVE", "Archivés"], ["TOUS", "Tous"]].map(([k, v]) => (
            <Link key={k} href={qs({ statut: k })} className="chip" style={statut === k ? { background: "var(--bg-active)", color: "var(--text)" } : undefined}>{v}</Link>
          ))}
          <span className="faint">·</span>
          {PHASES.map((ph) => (
            <Link key={ph} href={qs({ phase: phase === ph ? undefined : ph })} className="chip" style={phase === ph ? { background: "var(--bg-active)", color: "var(--text)" } : undefined}>{ph}</Link>
          ))}
        </div>
        <div className="card card-flush">
          {projects.length === 0 ? (
            <Empty>Aucun projet ne correspond.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Référence</th><th>Projet</th><th>Client</th><th>Ville</th><th>Avancement</th><th>État</th></tr></thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id} className="clickable">
                      <td className="mono nowrap">{p.reference}</td>
                      <td><Link href={`/projets/${p.id}`} className="link">{p.name}</Link></td>
                      <td>{p.client.name}</td>
                      <td>{p.city ?? "—"}</td>
                      <td style={{ minWidth: 220 }}>
                        <div className="progress"><span style={{ width: `${(p.step / 20) * 100}%` }} /></div>
                        <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>{stepPhase(p.step)} · {p.step}. {stepLabel(p.step)}</div>
                      </td>
                      <td><Badge tone={p.status === "EN_COURS" ? "ok" : "neutral"}>{PROJECT_STATUS_LABELS[p.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
