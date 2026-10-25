import Link from "next/link";

export default function NotFound() {
  return (
    <div className="content">
      <div className="card" style={{ marginTop: 40, textAlign: "center" }}>
        <h2>Introuvable</h2>
        <p className="muted" style={{ margin: "8px 0 16px" }}>Cet élément n'existe pas ou vous n'y avez pas accès.</p>
        <Link href="/" className="btn">Retour au tableau de bord</Link>
      </div>
    </div>
  );
}
