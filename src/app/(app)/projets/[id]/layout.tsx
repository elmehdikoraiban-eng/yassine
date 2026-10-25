import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can, projectScope } from "@/lib/permissions";
import { PROJECT_STATUS_LABELS, stepLabel, stepPhase } from "@/lib/constants";
import { Topbar, Badge } from "@/components/ui";
import { Tab } from "@/components/nav-link";
import { Icon } from "@/components/icons";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const project = await prisma.project.findFirst({
    where: { id, ...projectScope(user) },
    include: { client: { select: { id: true, name: true } } },
  });
  if (!project) notFound();
  const base = `/projets/${id}`;

  return (
    <>
      <Topbar crumbs={[{ href: "/projets", label: "Projets" }, { label: project.reference }]} />
      <div className="content">
        <div className="page-head" style={{ marginBottom: 14 }}>
          <div>
            <div className="row" style={{ marginBottom: 4 }}>
              <span className="mono faint">{project.reference}</span>
              <Badge tone={project.status === "EN_COURS" ? "ok" : "neutral"}>{PROJECT_STATUS_LABELS[project.status]}</Badge>
            </div>
            <h1>{project.name}</h1>
            <p className="muted">
              {can(user, "seeClients") ? <Link href={`/clients/${project.client.id}`} className="link">{project.client.name}</Link> : project.client.name}
              {project.city && ` · ${project.city}`} · {stepPhase(project.step)} — étape {project.step}/20, {stepLabel(project.step).toLowerCase()}
            </p>
          </div>
          {can(user, "manageProjects") && <Link href={`${base}/modifier`} className="btn"><Icon name="edit" /> Modifier</Link>}
        </div>
        <div className="stepper" aria-label={`Étape ${project.step} sur 20`}>
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i} className={i + 1 < project.step ? "done" : i + 1 === project.step ? "current" : ""} title={`${i + 1}. ${stepLabel(i + 1)}`} />
          ))}
        </div>
        <nav className="tabs">
          <Tab href={base} exact>Aperçu</Tab>
          <Tab href={`${base}/documents`}>Documents</Tab>
          <Tab href={`${base}/plans`}>Plans d'exécution</Tab>
          <Tab href={`${base}/intervenants`}>Intervenants</Tab>
          {can(user, "seeFinance") && <Tab href={`${base}/finances`}>Honoraires et factures</Tab>}
          <Tab href={`${base}/historique`}>Historique</Tab>
        </nav>
        {children}
      </div>
    </>
  );
}
