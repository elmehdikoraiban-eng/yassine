import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { DOC_STATE_LABELS, FOLDERS } from "@/lib/constants";
import { dateTime, fileSize } from "@/lib/format";
import { Badge, Empty, Field } from "@/components/ui";
import { Icon } from "@/components/icons";
import { createDocument } from "@/app/actions/documents";
import { Form } from "@/components/form";
import { FileField } from "@/components/file-field";
import { blobEnabled } from "@/lib/storage";

export default async function ProjectDocuments({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dossier?: string; obsoletes?: string }> }) {
  const { id } = await params;
  const { dossier, obsoletes } = await searchParams;
  const user = await requireUser();
  const folders = FOLDERS.filter((f) => !f.finance || can(user, "seeFinance"));
  const codes = folders.map((f) => f.code);
  const [counts, docs] = await Promise.all([
    prisma.document.groupBy({ by: ["folder"], where: { projectId: id, folder: { in: codes } }, _count: true }),
    prisma.document.findMany({
    where: {
      projectId: id,
      folder: dossier && codes.includes(dossier) ? dossier : { in: codes },
      ...(obsoletes ? {} : { state: { not: "OBSOLETE" } }),
    },
    orderBy: [{ folder: "asc" }, { updatedAt: "desc" }],
    include: { versions: { orderBy: { createdAt: "desc" }, take: 1, include: { author: { select: { name: true } } } }, _count: { select: { versions: true, distributions: true } } },
    }),
  ]);
  const countOf = (code: string) => counts.find((c) => c.folder === code)?._count ?? 0;
  const base = `/projets/${id}/documents`;

  return (
    <div className="stack">
      <div className="folders">
        <Link href={base} className={`folder${!dossier ? " active" : ""}`}><Icon name="layers" /> Tous les dossiers</Link>
        {folders.map((f) => (
          <Link key={f.code} href={`${base}?dossier=${f.code}`} className={`folder${dossier === f.code ? " active" : ""}`}>
            <Icon name="folder" />
            <span style={{ minWidth: 0 }}>
              <span className="mono faint" style={{ fontSize: 11, display: "block" }}>{f.code.slice(0, 2)}</span>
              {f.label}
            </span>
            <span className="count">{countOf(f.code)}</span>
          </Link>
        ))}
      </div>

      <div className="split">
        <div className="card card-flush">
          <div className="card-head">
            <h2>{dossier ? FOLDERS.find((f) => f.code === dossier)?.label : "Tous les documents"}</h2>
            <Link href={`${base}?${new URLSearchParams({ ...(dossier ? { dossier } : {}), ...(obsoletes ? {} : { obsoletes: "1" }) })}`} className="btn btn-ghost btn-sm">
              {obsoletes ? "Masquer les obsolètes" : "Afficher les obsolètes"}
            </Link>
          </div>
          {docs.length === 0 ? <Empty>Aucun document dans ce dossier.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Document</th><th>Indice</th><th>État</th><th>Dernière version</th><th className="num">Diffusions</th></tr></thead>
                <tbody>
                  {docs.map((d) => {
                    const v = d.versions[0];
                    return (
                      <tr key={d.id} className="clickable">
                        <td>
                          <Link href={`/documents/${d.id}`} className="link">{d.title}</Link>
                          {!dossier && <div className="faint mono" style={{ fontSize: 11 }}>{d.folder}</div>}
                        </td>
                        <td className="mono">{v?.index ?? "—"}<span className="faint"> /{d._count.versions}</span></td>
                        <td><Badge tone={d.state === "VALIDE" ? "ok" : d.state === "OBSOLETE" ? "muted" : "neutral"}>{DOC_STATE_LABELS[d.state]}</Badge></td>
                        <td className="muted" style={{ fontSize: 13 }}>{v ? `${dateTime(v.createdAt)} · ${v.author.name} · ${fileSize(v.size)}` : "Pas encore de fichier"}</td>
                        <td className="num">{d._count.distributions}</td>
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
            <h2>Déposer un document</h2>
            <Field label="Fichier"><FileField projectId={id} direct={blobEnabled()} required /></Field>
            <Field label="Intitulé" hint="Par défaut, le nom du fichier."><input name="title" /></Field>
            <Field label="Dossier">
              <select name="folder" defaultValue={dossier ?? "05_CONCEPTION"}>
                {folders.map((f) => <option key={f.code} value={f.code}>{f.code} · {f.label}</option>)}
              </select>
            </Field>
            <Field label="Commentaire"><input name="comment" placeholder="Objet de cette version" /></Field>
            <button className="btn btn-primary">Déposer (indice A)</button>
            <p className="hint">Pour réviser un document existant, ouvrez-le et déposez une nouvelle version : l'historique est conservé.</p>
          </Form>
        )}
      </div>
    </div>
  );
}
