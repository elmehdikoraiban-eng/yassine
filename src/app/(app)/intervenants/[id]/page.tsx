import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { STAKEHOLDER_KIND_LABELS } from "@/lib/constants";
import { dateTime, fileSize } from "@/lib/format";
import { Topbar, PageHead, Field, Empty } from "@/components/ui";
import { Form } from "@/components/form";
import { uploadStakeholderFile } from "@/app/actions/projects";
import { FileField } from "@/components/file-field";
import { blobEnabled } from "@/lib/storage";

export default async function StakeholderDrivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!can(user, "manageStakeholders")) notFound();
  const stakeholder = await prisma.stakeholder.findUnique({
    where: { id },
    include: { files: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } } },
  });
  if (!stakeholder) notFound();
  return (
    <>
      <Topbar crumbs={[{ href: "/intervenants", label: "Intervenants" }, { label: stakeholder.name }]} />
      <div className="content">
        <PageHead title={stakeholder.name} subtitle={STAKEHOLDER_KIND_LABELS[stakeholder.kind] + " · Drive privé"} />
        <div className="split">
          <div className="card card-flush">
            <div className="card-head"><h2>Fichiers</h2></div>
            {stakeholder.files.length === 0 ? <Empty>Aucun fichier partagé avec cet intervenant.</Empty> : (
              <div className="list">
                {stakeholder.files.map((file) => (
                  <div className="list-item" key={file.id}>
                    <div className="grow">
                      <a className="link" href={"/api/intervenants/fichiers/" + file.id}>{file.fileName}</a>
                      <p className="faint" style={{ fontSize: 12 }}>{fileSize(file.size)} · {dateTime(file.createdAt)} · {file.author.name}</p>
                    </div>
                    <a className="btn btn-sm" href={"/api/intervenants/fichiers/" + file.id}>Télécharger</a>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Form action={uploadStakeholderFile.bind(null, stakeholder.id)} className="card form">
            <h2>Ajouter un fichier</h2>
            <Field label="Fichier" hint="Plans ou pièces reçus, 25 Mo maximum.">
              <FileField projectId={stakeholder.id} direct={blobEnabled()} required scope="stakeholder" />
            </Field>
            <button className="btn btn-primary">Ajouter au Drive</button>
          </Form>
        </div>
      </div>
    </>
  );
}

