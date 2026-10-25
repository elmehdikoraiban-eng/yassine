import { CardSkeleton } from "@/components/skeleton";

// Changement d'onglet d'un projet : l'en-tête reste affiché, seul le contenu attend.
export default function Loading() {
  return (
    <>
      <div className="loading-bar" aria-hidden />
      <div className="split" aria-busy="true" aria-label="Chargement">
        <div className="stack"><CardSkeleton lines={3} /><CardSkeleton lines={5} /></div>
        <div className="stack"><CardSkeleton lines={6} /></div>
      </div>
    </>
  );
}
