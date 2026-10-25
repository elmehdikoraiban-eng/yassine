import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Topbar, PageHead } from "@/components/ui";
import { ClientForm } from "@/components/forms/client-form";
import { updateClient } from "@/app/actions/clients";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "manageClients")) notFound();
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();
  return (
    <>
      <Topbar crumbs={[{ href: "/clients", label: "Clients" }, { href: `/clients/${id}`, label: client.name }, { label: "Modifier" }]} />
      <div className="content" style={{ maxWidth: 820 }}>
        <PageHead title="Modifier la fiche client" />
        <ClientForm client={client} action={updateClient.bind(null, id)} submit="Enregistrer" />
      </div>
    </>
  );
}
