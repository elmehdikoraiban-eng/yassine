import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CLIENT_TYPE_LABELS } from "@/lib/constants";
import { Topbar, PageHead, Empty, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  if (!can(user, "seeClients")) notFound();
  const { q } = await searchParams;
  const clients = await prisma.client.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { ice: { contains: q } }, { phone: { contains: q } }] }
      : {},
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true } } },
  });

  return (
    <>
      <Topbar crumbs={[{ label: "Clients" }]} />
      <div className="content">
        <PageHead
          title="Clients"
          subtitle={`${clients.length} fiche${clients.length > 1 ? "s" : ""} client`}
          actions={can(user, "manageClients") && <Link href="/clients/nouveau" className="btn btn-primary"><Icon name="plus" /> Nouveau client</Link>}
        />
        <form className="composer" style={{ marginBottom: 16 }}>
          <Icon name="search" width={18} height={18} className="faint" />
          <input name="q" defaultValue={q} placeholder="Filtrer par nom, ville, ICE ou téléphone" />
        </form>
        <div className="card card-flush">
          {clients.length === 0 ? (
            <Empty>Aucun client pour l'instant.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Nom</th><th>Type</th><th>Ville</th><th>Téléphone</th><th>E-mail</th><th className="num">Projets</th></tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="clickable">
                      <td><Link href={`/clients/${c.id}`} className="link">{c.name}</Link></td>
                      <td><Badge plain>{CLIENT_TYPE_LABELS[c.type]}</Badge></td>
                      <td>{c.city ?? "—"}</td>
                      <td className="nowrap">{c.phone ?? "—"}</td>
                      <td>{c.email ?? "—"}</td>
                      <td className="num">{c._count.projects}</td>
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
