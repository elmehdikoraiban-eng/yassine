import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { dateTime } from "@/lib/format";
import { Topbar, PageHead, Badge } from "@/components/ui";

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  if (!can(user, "seeAudit")) notFound();
  const { q } = await searchParams;
  const logs = await prisma.auditLog.findMany({
    where: q ? { OR: [{ summary: { contains: q, mode: "insensitive" } }, { entity: { contains: q, mode: "insensitive" } }, { user: { name: { contains: q, mode: "insensitive" } } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { user: { select: { name: true } } },
  });
  return (
    <>
      <Topbar crumbs={[{ label: "Journal" }]} />
      <div className="content">
        <PageHead title="Journal de traçabilité" subtitle="Toutes les actions importantes : date, auteur, élément concerné (§12, §28)." />
        <form style={{ marginBottom: 14 }}><input name="q" defaultValue={q} placeholder="Filtrer par texte, type ou personne" style={{ borderRadius: 999, maxWidth: 420 }} /></form>
        <div className="card card-flush">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Personne</th><th>Élément</th><th>Action</th><th>Détail</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="nowrap">{dateTime(l.createdAt)}</td>
                    <td className="nowrap">{l.user?.name ?? "Système"}</td>
                    <td><Badge plain>{l.entity}</Badge></td>
                    <td className="muted">{l.action}</td>
                    <td>{l.projectId ? <Link className="link" href={`/projets/${l.projectId}/historique`}>{l.summary}</Link> : l.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
