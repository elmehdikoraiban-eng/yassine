import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { get, head, put } from "@vercel/blob";

// Deux modes de stockage des fichiers :
// - Vercel Blob (privé) lorsque BLOB_READ_WRITE_TOKEN est défini, en production sur Vercel ;
// - disque local (STORAGE_DIR) sinon, pour le développement ou un serveur classique.
export const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const root = () => path.resolve(process.env.STORAGE_DIR || "./storage");
const safeName = (name: string) => name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-120);

export type Stored = { storagePath: string; size: number; mime: string; fileName: string };

export async function saveFile(projectId: string, file: File): Promise<Stored> {
  const mime = file.type || "application/octet-stream";
  if (blobEnabled()) {
    const b = await put(`${projectId}/${safeName(file.name)}`, file, { access: "private", addRandomSuffix: true, contentType: mime });
    return { storagePath: b.url, size: file.size, mime, fileName: file.name };
  }
  const rel = path.join(projectId, `${randomUUID()}-${safeName(file.name)}`);
  const abs = path.join(root(), rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, Buffer.from(await file.arrayBuffer()));
  return { storagePath: rel, size: file.size, mime, fileName: file.name };
}

/** Fichier déjà envoyé directement par le navigateur vers Vercel Blob (gros plans). */
export async function registerUploaded(projectId: string, url: string, fileName: string): Promise<Stored> {
  if (!blobEnabled()) throw new Error("Téléversement direct indisponible.");
  const h = await head(url); // échoue si l'URL n'appartient pas au stockage du cabinet
  if (!h.pathname.startsWith(`${projectId}/`)) throw new Error("Fichier rattaché à un autre projet.");
  return { storagePath: h.url, size: h.size, mime: h.contentType || "application/octet-stream", fileName };
}

export async function readStored(storagePath: string): Promise<BodyInit> {
  if (storagePath.startsWith("https://")) {
    const r = await get(storagePath, { access: "private" });
    if (!r?.stream) throw new Error("Fichier introuvable");
    return r.stream;
  }
  const abs = path.resolve(root(), storagePath);
  if (!abs.startsWith(root() + path.sep)) throw new Error("Chemin invalide");
  return new Uint8Array(await readFile(abs));
}
