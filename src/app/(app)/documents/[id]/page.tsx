import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can, projectScope } from "@/lib/permissions";
import { DOC_STATE_LABELS, FOLDERS, PLAN_STATUS_LABELS, PLAN_TONE } from "@/lib/constants";
import { dateTime, fileSize } from "@/lib/format";
import { Topbar, PageHead, Badge, Field } from "@/components/ui";
import { Icon } from "@/components/icons";
import { addVersion, distribute, moveDocument, setDocState, setPlanStatus } from "@/app/actions/documents";
import { Form } from "@/components/form";
import { FileField } from "@/components/file-field";
import { blobEnabled } from "@/lib/storage";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const doc = await prisma.document.findFirst({
    where: { id, project: projectScope(user) },
    include: {
      project: { select: { id: true, name: true, reference: true, stakeholders: { include: { stakeholder: true } } } },
      versions: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      distributions: { orderBy: { date: "desc" }, include: { stakeholder: true, version: { select: { index: true } } } },
    },
  });
  if (!doc) notFound();
  const folder = FOLDERS.find((f) => f.code === doc.folder);
  if (folder?.finance && !can(user, "seeFinance")) notFound();
  const current = doc.versions[0];
  const visibleFolders = FOLDERS.filter((f) => !f.finance || can(user, "seeFinance"));

  return (
    <>
      <Topbar
        crumbs={[
          { href: "/projets", label: "Projets" },
          { href: `/projets/${doc.project.id}`, label: doc.project.reference },
          { href: `/projets/${doc.project.id}/documents?dossier=${doc.folder}`, label: folder?.label ?? doc.folder },
          { label: doc.title },
        ]}
      />
      <div className="content">
        <PageHead
          title={<span className="row" style={{ gap: 10 }}>{doc.planCode && <span className="mono faint">{doc.planCode}</span>}{doc.title}</span>}
          subtitle={
            <span className="row" style={{ marginTop: 6 }}>
              <Badge tone={doc.state === "VALIDE" ? "ok" : doc.state === "OBSOLETE" ? "muted" : "neutral"}>{DOC_STATE_LABELS[doc.state]}</Badge>
              {doc.isPlan && doc.planStatus && <Badge tone={PLAN_TONE[doc.planStatus]}>Plan : {PLAN_STATUS_LABELS[doc.planStatus]}</Badge>}
              {current && <span className="faint">Version en vigueur : indice {current.index}</span>}
            </span>
          }
          actions={current && (
            <>
              <a className="btn" href={`/api/fichiers/${current.id}?apercu`} target="_blank" rel="noreferrer">Aperçu</a>
              <a className="btn btn-primary" href={`/api/fichiers/${current.id}`}><Icon name="download" /> Télécharger</a>
            </>
          )}
        />
        {doc.state === "OBSOLETE" && <div className="notice danger" style={{ marginBottom: 16 }}>Ce document est obsolète : il ne doit plus être utilisé comme référence.</div>}

        <div className="split">
          <div className="stack">
            <div className="card card-flush">
              <div className="card-head"><h2>Versions</h2><span className="faint">L'historique n'est jamais écrasé.</span></div>
              {doc.versions.length === 0 ? <p className="empty">Pas encore de fichier.</p> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Indice</th><th>Fichier</th><th>Auteur</th><th>Date</th><th>Commentaire</th><th /></tr></thead>
                    <tbody>
                      {doc.versions.map((v, i) => (
                        <tr key={v.id}>
                          <td className="mono">{v.index}{i === 0 && <span className="faint"> · en vigueur</span>}</td>
                          <td>{v.fileName} <span className="faint">({fileSize(v.size)})</span></td>
                          <td>{v.author.name}</td>
                          <td className="nowrap">{dateTime(v.createdAt)}</td>
                          <td className="muted">{v.comment ?? "—"}</td>
                          <td><a className="btn btn-ghost btn-sm" href={`/api/fichiers/${v.id}`}><Icon name="download" /></a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card card-flush">
              <div className="card-head"><h2>Diffusion aux tiers</h2></div>
              {doc.distributions.length === 0 ? <p className="empty">Jamais transmis.</p> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Date</th><th>Destinataire</th><th>Indice</th><th>Par</th><th>Note</th></tr></thead>
                    <tbody>
                      {doc.distributions.map((d) => (
                        <tr key={d.id}>
                          <td className="nowrap">{dateTime(d.date)}</td>
                          <td>{d.stakeholder?.name ?? d.recipient}</td>
                          <td className="mono">{d.version.index}</td>
                          <td>{d.userName}</td>
                          <td className="muted">{d.note ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="stack">
            {can(user, "uploadDocuments") && (
              <Form action={addVersion.bind(null, id)} className="card form">
                <h2>Nouvelle version</h2>
                <FileField projectId={doc.project.id} direct={blobEnabled()} required />
                <input name="comment" placeholder="Objet de la révision" />
                <button className="btn btn-primary">Déposer l'indice suivant</button>
              </Form>
            )}

            {can(user, "changePlanStatus") && (
              <div className="card form">
                <h2>État</h2>
                <Form action={setDocState.bind(null, id)} className="inline-form">
                  <select name="state" defaultValue={doc.state}>
                    {Object.entries(DOC_STATE_LABELS)
                      .filter(([k]) => k !== "VALIDE" || can(user, "validateDocuments"))
                      .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button className="btn btn-sm">Appliquer</button>
                </Form>
                {doc.isPlan && (
                  <Form action={setPlanStatus.bind(null, id)} className="inline-form">
                    <select name="planStatus" defaultValue={doc.planStatus ?? "A_PREPARER"}>
                      {Object.entries(PLAN_STATUS_LABELS)
                        .filter(([k]) => k !== "VALIDE" || can(user, "validateDocuments"))
                        .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button className="btn btn-sm">Appliquer</button>
                  </Form>
                )}
                {!can(user, "validateDocuments") && <p className="hint">La validation est réservée à l'architecte gérant.</p>}
              </div>
            )}

            {can(user, "distributeDocuments") && current && (
              <Form action={distribute.bind(null, id)} className="card form">
                <h2>Transmettre l'indice {current.index}</h2>
                <Field label="Intervenant du projet">
                  <select name="stakeholderId" defaultValue="">
                    <option value="">— Autre destinataire —</option>
                    {doc.project.stakeholders.map(({ stakeholder: s }) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Autre destinataire"><input name="recipient" placeholder="Client, administration…" /></Field>
                <Field label="Note"><input name="note" placeholder="Moyen de transmission, objet" /></Field>
                <button className="btn">Enregistrer la diffusion</button>
                <p className="hint">La plateforme trace la transmission ; l'envoi lui-même (e-mail, lien, papier) reste à faire.</p>
              </Form>
            )}

            {can(user, "changePlanStatus") && (
              <Form action={moveDocument.bind(null, id)} className="card form">
                <h2>Classement</h2>
                <input name="title" defaultValue={doc.title} />
                <select name="folder" defaultValue={doc.folder}>
                  {visibleFolders.map((f) => <option key={f.code} value={f.code}>{f.code} · {f.label}</option>)}
                </select>
                <button className="btn btn-sm">Enregistrer</button>
              </Form>
            )}
            <Link href={`/projets/${doc.project.id}/documents`} className="btn btn-ghost">← Documents du projet</Link>
          </div>
        </div>
      </div>
    </>
  );
}
