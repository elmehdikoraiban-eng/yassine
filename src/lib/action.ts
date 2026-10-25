import { unstable_rethrow } from "next/navigation";
import { Prisma } from "@prisma/client";

export type ActionResult = { error?: string; ok?: boolean } | undefined;

/** Exécute une action serveur et transforme les erreurs en message lisible pour le formulaire. */
export async function run(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e); // laisse passer redirect() et notFound()
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "Cette valeur existe déjà (doublon)." };
    if (e instanceof Prisma.PrismaClientKnownRequestError || e instanceof Prisma.PrismaClientValidationError) {
      console.error(e);
      return { error: "Enregistrement impossible : vérifiez les champs saisis." };
    }
    if (e instanceof Error) return { error: e.message };
    return { error: "Une erreur est survenue." };
  }
}
