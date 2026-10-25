import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ProjectForm } from "@/components/forms/project-form";
import { updateProject } from "@/app/actions/projects";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "manageProjects")) notFound();
  const [project, clients] = await Promise.all([
    prisma.project.findUnique({ where: { id } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!project) notFound();
  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={{ marginBottom: 14 }}>Modifier les informations</h2>
      <ProjectForm project={project} clients={clients} action={updateProject.bind(null, id)} submit="Enregistrer" />
    </div>
  );
}
