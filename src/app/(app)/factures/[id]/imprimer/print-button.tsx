"use client";

export function PrintButton() {
  return <button className="btn btn-primary" onClick={() => window.print()}>Imprimer ou enregistrer en PDF</button>;
}
