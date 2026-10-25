import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { Topbar, PageHead, Empty } from "@/components/ui";

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 60 });
  // Ouvrir la page vaut lecture ; l'affichage garde la mise en évidence des nouveautés.
  if (items.some((n) => !n.readAt)) {
    await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  }
  return (
    <>
      <Topbar crumbs={[{ label: "Notifications" }]} />
      <div className="content" style={{ maxWidth: 820 }}>
        <PageHead title="Notifications" subtitle="Affectations, nouveaux dossiers et consignes de l'équipe." />
        <div className="card card-flush">
          {items.length === 0 ? <Empty>Aucune notification pour le moment.</Empty> : items.map((n) => {
            const body = (
              <>
                <span className="notif-dot" />
                <div className="grow">
                  <strong style={{ display: "block" }}>{n.title}</strong>
                  {n.body && <p className="muted" style={{ whiteSpace: "pre-wrap", marginTop: 2 }}>{n.body}</p>}
                  <p className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>{dateTime(n.createdAt)}{n.actorName ? ` · ${n.actorName}` : ""}</p>
                </div>
              </>
            );
            return n.href
              ? <Link key={n.id} href={n.href} className={`notif${n.readAt ? "" : " unread"}`}>{body}</Link>
              : <div key={n.id} className={`notif${n.readAt ? "" : " unread"}`}>{body}</div>;
          })}
        </div>
      </div>
    </>
  );
}
