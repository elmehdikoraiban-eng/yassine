import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PROJECT_STATUS_LABELS, ROLE_LABELS, STEPS, stepLabel, DOC_STATE_LABELS } from "@/lib/constants";
import { date, dateTime, money, num } from "@/lib/format";
import { feeSummary } from "@/lib/finance";
import { Badge, Stat } from "@/components/ui";
import { changeStep, sendInstruction, setMembers, setProjectStatus } from "@/app/actions/projects";
import { Form } from "@/components/form";

export default async function ProjectOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const manage = can(user, "manageProjects");
  const [p, users] = await Promise.all([prisma.project.findUniqueOrThrow({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, name: true, role: true } } } },
      stepChanges: { orderBy: { createdAt: "desc" }, take: 5 },
      documents: { orderBy: { updatedAt: "desc" }, take: 6, include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } } },
      contract: true,
      invoices: { include: { payments: true } },
      _count: { select: { documents: true, stakeholders: true } },
    },
  }), manage ? prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }) : Promise.resolve([])]);
  const memberIds = new Set(p.members.map((m) => m.userId));
  const fees = p.contract ? feeSummary(num(p.contract.amountHT), num(p.contract.vatRate), p.invoices) : null;

  const info: [string, React.ReactNode][] = [
    ["Nature", p.nature],
    ["Localisation", [p.location, p.city].filter(Boolean).join(", ")],
    ["Titre foncier", p.landTitle],
    ["Surface terrain", p.surfaceTerrain ? `${num(p.surfaceTerrain).toLocaleString("fr-FR")} m²` : null],
    ["Surface construite", p.surfaceConstruite ? `${num(p.surfaceConstruite).toLocaleString("fr-FR")} m²` : null],
    ["Ouverture", date(p.startDate)],
  ];

  return (
    <div className="split">
      <div className="stack">
        {fees && (
          <div className="card">
            <div className="card-head">
              <h2>Avancement et honoraires</h2>
              <Link href={`/projets/${id}/finances`} className="btn btn-sm">Détail</Link>
            </div>
            <div className="grid grid-3" style={{ marginBottom: 14 }}>
              <Stat label="Mission" value={`${Math.round((p.step / 20) * 100)} %`} sub={`Étape ${p.step}/20`} />
              <Stat label="Facturé" value={`${fees.contractual ? Math.round((fees.invoiced / fees.contractual) * 100) : 0} %`} sub={money(fees.invoiced)} />
              <Stat label="Encaissé" value={`${fees.contractual ? Math.round((fees.collected / fees.contractual) * 100) : 0} %`} sub={money(fees.collected)} />
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-head"><h2>Informations</h2></div>
          <dl className="kv">
            {info.map(([k, v]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>{k}</dt><dd>{v || <span className="faint">—</span>}</dd>
              </div>
            ))}
          </dl>
          {p.programme && <p className="notice" style={{ marginTop: 14, whiteSpace: "pre-wrap" }}>{p.programme}</p>}
          {p.technicianObjective && <div className="notice" style={{ marginTop: 12 }}><strong>Objectif des techniciens</strong><p style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{p.technicianObjective}</p></div>}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Documents récents</h2>
            <Link href={`/projets/${id}/documents`} className="btn btn-sm">Tous ({p._count.documents})</Link>
          </div>
          <div className="list">
            {p.documents.length === 0 && <p className="faint">Aucun document déposé.</p>}
            {p.documents.map((d) => (
              <div key={d.id} className="list-item">
                <div className="grow">
                  <Link href={`/documents/${d.id}`} className="link">{d.title}</Link>
                  <p className="faint" style={{ fontSize: 12.5 }}>{d.folder} · indice {d.versions[0]?.index ?? "—"} · {dateTime(d.updatedAt)}</p>
                </div>
                <Badge tone={d.state === "VALIDE" ? "ok" : d.state === "OBSOLETE" ? "muted" : "neutral"}>{DOC_STATE_LABELS[d.state]}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <div className="card-head"><h2>Étape du processus</h2></div>
          <ol className="steps-list">
            {STEPS.map((s) => (
              <li key={s.n} className={s.n < p.step ? "done" : s.n === p.step ? "current" : ""}>
                <span className="dot">{s.n < p.step ? "✓" : s.n}</span>
                <span style={{ fontSize: 13 }}>{s.label}</span>
              </li>
            ))}
          </ol>
          {manage && (
            <Form action={changeStep.bind(null, id)} className="form" style={{ marginTop: 14 }}>
              <select name="step" defaultValue={Math.min(p.step + 1, 20)}>
                {STEPS.map((s) => <option key={s.n} value={s.n}>{s.n}. {s.label}</option>)}
              </select>
              <input name="comment" placeholder="Commentaire (facultatif)" />
              <button className="btn btn-primary">Changer d'étape</button>
            </Form>
          )}
          {p.stepChanges.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {p.stepChanges.map((c) => (
                <p key={c.id} className="faint" style={{ fontSize: 12.5 }}>
                  {date(c.createdAt)} · {c.userName} : {c.fromStep} → {c.toStep}{c.comment ? ` — ${c.comment}` : ""}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head"><h2>Équipe</h2></div>
          {manage ? (
            <Form action={setMembers.bind(null, id)} className="form">
              {users.map((u) => (
                <label key={u.id} className="row" style={{ gap: 8 }}>
                  <input type="checkbox" name="members" value={u.id} defaultChecked={memberIds.has(u.id)} />
                  <span>{u.name}</span>
                  <span className="faint" style={{ fontSize: 12 }}>{ROLE_LABELS[u.role]}</span>
                </label>
              ))}
              <button className="btn btn-sm">Mettre à jour l'équipe</button>
            </Form>
          ) : (
            <div className="list">
              {p.members.map((m) => (
                <div key={m.userId} className="list-item">
                  <span>{m.user.name}</span><span className="faint">{ROLE_LABELS[m.user.role]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {p.members.some((m) => m.userId !== user.id) && (
          <div className="card">
            <div className="card-head"><h2>Consigne à l'équipe</h2></div>
            <Form action={sendInstruction.bind(null, id)} className="form">
              <textarea name="message" required placeholder="Ex. Mettre à jour les plans de façade selon la remarque du client." />
              <div className="row" style={{ gap: 12 }}>
                {p.members.filter((m) => m.userId !== user.id).map((m) => (
                  <label key={m.userId} className="check"><input type="checkbox" name="to" value={m.userId} defaultChecked /> {m.user.name}</label>
                ))}
              </div>
              <button className="btn btn-sm">Envoyer la notification</button>
            </Form>
          </div>
        )}

        {manage && (
          <div className="card">
            <div className="card-head"><h2>Statut du dossier</h2></div>
            <Form action={setProjectStatus.bind(null, id)} className="inline-form">
              <select name="status" defaultValue={p.status}>
                {Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button className="btn btn-sm">Appliquer</button>
            </Form>
            {p.step === 20 && p.status === "EN_COURS" && (
              <p className="hint" style={{ marginTop: 8 }}>Le projet est à l'étape « {stepLabel(20)} » : vérifiez les factures et documents finaux avant de le clôturer.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

