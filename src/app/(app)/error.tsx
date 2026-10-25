"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="content">
      <div className="card" style={{ marginTop: 40, textAlign: "center" }}>
        <h2>Une erreur est survenue</h2>
        <p className="muted" style={{ margin: "8px 0 16px" }}>{error.message || "Réessayez dans un instant."}</p>
        <button className="btn" onClick={reset}>Réessayer</button>
      </div>
    </div>
  );
}
