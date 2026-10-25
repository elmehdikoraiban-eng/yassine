import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Topbar, PageHead } from "@/components/ui";
import { ClientForm } from "@/components/forms/client-form";
import { createClient } from "@/app/actions/clients";

export default async function NewClientPage() {
  const user = await requireUser();
  if (!can(user, "manageClients")) notFound();
  return (
    <>
      <Topbar crumbs={[{ href: "/clients", label: "Clients" }, { label: "Nouveau" }]} />
      <div className="content" style={{ maxWidth: 820 }}>
        <PageHead title="Nouveau client" subtitle="Une fiche unique par client, reprise dans tous ses projets et factures." />
        <ClientForm action={createClient} submit="Créer la fiche" />
      </div>
    </>
  );
}
