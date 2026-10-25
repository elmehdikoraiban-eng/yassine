/** Squelettes affichés instantanément pendant le chargement d'une page. */
export function Sk({ w = "100%", h = 14, style }: { w?: number | string; h?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width: w, height: h, ...style }} />;
}

export function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="card">
      <Sk w="35%" h={16} style={{ marginBottom: 18 }} />
      <div className="stack" style={{ gap: 12 }}>
        {Array.from({ length: lines }, (_, i) => <Sk key={i} w={`${90 - ((i * 17) % 35)}%`} />)}
      </div>
    </div>
  );
}
