"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";

/**
 * Champ fichier. En mode direct (Vercel Blob), le fichier part du navigateur vers le stockage
 * dès qu'il est choisi, ce qui lève la limite de 4,5 Mo des fonctions ; le formulaire n'envoie
 * ensuite que l'adresse du fichier.
 */
export function FileField({ projectId, direct, required, scope = "project" }: { projectId: string; direct: boolean; required?: boolean; scope?: "project" | "stakeholder" }) {
  const [state, setState] = useState<{ url?: string; name?: string; progress?: number; error?: string }>({});
  if (!direct) return <input type="file" name="file" required={required} />;

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return setState({});
    const safe = file.name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-120);
    setState({ progress: 0 });
    try {
      const prefix = scope === "stakeholder" ? "intervenants/" + projectId : projectId;
      const path = prefix + "/" + safe;
      const clientPayload = scope === "stakeholder" ? "stakeholder:" + projectId : projectId;
      const blob = await upload(path, file, {
        access: "private",
        handleUploadUrl: "/api/televersement",
        clientPayload,
        multipart: file.size > 8 * 1024 * 1024,
        onUploadProgress: (p) => setState({ progress: Math.round(p.percentage) }),
      });
      setState({ url: blob.url, name: file.name });
    } catch (err) {
      setState({ error: `Échec du téléversement : ${(err as Error).message}` });
    }
  }

  return (
    <div className="stack" style={{ gap: 6, position: "relative" }}>
      <input type="file" onChange={onChange} />
      <input
        name="blobUrl" value={state.url ?? ""} required={required} readOnly tabIndex={-1} aria-hidden
        style={{ position: "absolute", opacity: 0, width: 1, height: 1, bottom: 0, left: 20, pointerEvents: "none" }}
      />
      <input type="hidden" name="blobName" value={state.name ?? ""} />
      {state.progress != null && !state.url && !state.error && <span className="hint">Envoi en cours… {state.progress} %</span>}
      {state.url && <span className="hint" style={{ color: "var(--accent)" }}>Fichier prêt</span>}
      {state.error && <span className="hint" style={{ color: "var(--danger)" }}>{state.error}</span>}
    </div>
  );
}

