import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Topbar, PageHead } from "@/components/ui";
import { ProjectForm } from "@/components/forms/project-form";
import { createProject } from "@/app/actions/projects";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await requireUser();
  if (!can(user, "manageProjects")) notFound();
  const { client } = await searchParams;
  const [clients, users] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { active: true, id: { not: user.id } }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
  ]);
  return (
    <>
      <Topbar crumbs={[{ href: "/projets", label: "Projets" }, { label: "Nouveau" }]} />
      <div className="content" style={{ maxWidth: 820 }}>
        <PageHead title="Ouvrir un dossier projet" subtitle="La référence est attribuée automatiquement et l'arborescence type (§11) est créée." />
        {clients.length === 0 ? (
          <div className="notice">Créez d'abord une fiche client.</div>
        ) : (
          <ProjectForm clients={clients} users={users} defaultClient={client} action={createProject} submit="Ouvrir le dossier" />
        )}
      </div>
    </>
  );
}
