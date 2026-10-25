import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { dateTime } from "@/lib/format";
import { Badge } from "@/components/ui";

const FINANCE_ENTITIES = ["Facture", "Contrat", "Règlement"];

export default async function ProjectHistory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const logs = await prisma.auditLog.findMany({
    where: { projectId: id, ...(can(user, "seeFinance") ? {} : { entity: { notIn: FINANCE_ENTITIES } }) },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
    take: 300,
  });
  return (
    <div className="card">
      <div className="card-head"><h2>Historique chronologique</h2><span className="faint">{logs.length} événements</span></div>
      <div className="list">
        {logs.length === 0 && <p className="faint">Aucun événement.</p>}
        {logs.map((l) => (
          <div key={l.id} className="list-item">
            <Badge plain>{l.entity}</Badge>
            <div className="grow">
              <p>{l.summary}</p>
              <p className="faint" style={{ fontSize: 12.5 }}>{dateTime(l.createdAt)} · {l.user?.name ?? "Système"} · {l.action}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
