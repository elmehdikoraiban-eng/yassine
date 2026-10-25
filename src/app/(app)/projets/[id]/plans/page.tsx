import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PLAN_STATUS_LABELS, PLAN_TONE } from "@/lib/constants";
import { date } from "@/lib/format";
import { Badge, Empty, Field, Stat } from "@/components/ui";
import { createDocument } from "@/app/actions/documents";
import { Form } from "@/components/form";
import { FileField } from "@/components/file-field";
import { blobEnabled } from "@/lib/storage";

export default async function ProjectPlans({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const plans = await prisma.document.findMany({
    where: { projectId: id, isPlan: true },
    orderBy: [{ planCode: "asc" }, { title: "asc" }],
    include: {
      versions: { orderBy: { createdAt: "desc" }, take: 1, include: { author: { select: { name: true } } } },
      distributions: { orderBy: { date: "desc" }, include: { stakeholder: { select: { name: true } } } },
    },
  });
  const by = (s: string) => plans.filter((p) => p.planStatus === s).length;

  return (
    <div className="stack">
      <div className="grid grid-4">
        <Stat label="Plans prévus" value={plans.length} />
        <Stat label="À préparer / en cours" value={by("A_PREPARER") + by("EN_COURS") + by("REVISE")} />
        <Stat label="À vérifier" value={by("A_VERIFIER")} />
        <Stat label="Validés ou diffusés" value={by("VALIDE") + by("DIFFUSE")} />
      </div>
      <div className="split">
        <div className="card card-flush">
          <div className="card-head"><h2>Liste des plans d'exécution</h2></div>
          {plans.length === 0 ? <Empty>Aucun plan prévu. Ajoutez la liste des plans à produire selon la nature du projet.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>N°</th><th>Plan</th><th>Indice</th><th>État</th><th>Auteur · date</th><th>Dernière diffusion</th></tr></thead>
                <tbody>
                  {plans.map((p) => {
                    const v = p.versions[0];
                    const d = p.distributions[0];
                    return (
                      <tr key={p.id} className="clickable" style={p.state === "OBSOLETE" ? { opacity: 0.55 } : undefined}>
                        <td className="mono">{p.planCode ?? "—"}</td>
                        <td><Link href={`/documents/${p.id}`} className="link">{p.title}</Link></td>
                        <td className="mono">{v?.index ?? "—"}</td>
                        <td><Badge tone={PLAN_TONE[p.planStatus ?? "A_PREPARER"]}>{PLAN_STATUS_LABELS[p.planStatus ?? "A_PREPARER"]}</Badge></td>
                        <td className="muted" style={{ fontSize: 13 }}>{v ? `${v.author.name} · ${date(v.createdAt)}` : "—"}</td>
                        <td className="muted" style={{ fontSize: 13 }}>{d ? `${d.stakeholder?.name ?? d.recipient} · ${date(d.date)}` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {can(user, "uploadDocuments") && (
          <Form action={createDocument.bind(null, id)} className="card form">
            <h2>Ajouter un plan</h2>
            <input type="hidden" name="folder" value="07_PLANS_EXECUTION" />
            <input type="hidden" name="isPlan" value="on" />
            <Field label="N° de plan"><input name="planCode" placeholder="Ex. EXE-ARC-101" /></Field>
            <Field label="Intitulé *"><input name="title" required placeholder="Ex. Plan du rez-de-chaussée" /></Field>
            <Field label="Fichier" hint="Facultatif : sans fichier, le plan est noté « à préparer »."><FileField projectId={id} direct={blobEnabled()} /></Field>
            <button className="btn btn-primary">Ajouter</button>
          </Form>
        )}
      </div>
    </div>
  );
}
