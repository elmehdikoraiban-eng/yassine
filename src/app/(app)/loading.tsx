import { CardSkeleton, Sk } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <div className="loading-bar" aria-hidden />
      <div className="topbar"><Sk w={160} /></div>
      <div className="content" aria-busy="true" aria-label="Chargement">
        <div className="page-head"><div><Sk w={220} h={24} /><Sk w={300} style={{ marginTop: 8 }} /></div></div>
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="stat"><Sk w="60%" /><Sk w="40%" h={22} style={{ marginTop: 8 }} /></div>)}
        </div>
        <CardSkeleton lines={6} />
      </div>
    </>
  );
}
