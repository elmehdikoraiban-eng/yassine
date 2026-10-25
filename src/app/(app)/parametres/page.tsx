import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { num } from "@/lib/format";
import { Topbar, PageHead, Field } from "@/components/ui";
import { saveBrand, saveSettings } from "@/app/actions/admin";
import { Form } from "@/components/form";

export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user, "manageUsers")) notFound();
  const s = await prisma.settings.findFirst({ });
  const f = (k: keyof NonNullable<typeof s>) => (s ? String(s[k] ?? "") : "");
  return (
    <>
      <Topbar crumbs={[{ label: "Paramètres" }]} />
      <div className="content" style={{ maxWidth: 820 }}>
        <PageHead title="Paramètres du cabinet" />
        <Form action={saveBrand} className="card form" style={{ marginBottom: 16 }}>
          <h2>Nom, logo et favicon</h2>
          <p className="hint" style={{ marginTop: -6 }}>Affichés dans le menu, l'onglet du navigateur et la page de connexion.</p>
          <div className="form-grid">
            <Field label="Nom affiché dans l'application" full><input name="appName" required maxLength={60} defaultValue={s?.appName ?? "Cabinet"} /></Field>
            <Group label="Logo" hint="PNG, JPG, SVG ou WebP, 1 Mo au plus. Carré de préférence.">
              <div className="brand-upload">
                {s?.logoPath ? <img src={`/api/marque/logo?v=${s.brandVersion}`} alt="" className="brand-preview" /> : <span className="brand-mark">{(s?.appName || "C").trim()[0]?.toUpperCase()}</span>}
                <input type="file" name="logo" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" />
              </div>
              {s?.logoPath && <label className="check"><input type="checkbox" name="removeLogo" /> Retirer le logo</label>}
            </Group>
            <Group label="Favicon (icône de l'onglet)" hint="PNG, ICO ou SVG carré, 32 × 32 px ou plus.">
              <div className="brand-upload">
                <img src={`/api/marque/favicon?v=${s?.brandVersion ?? 0}`} alt="" className="brand-preview" />
                <input type="file" name="favicon" accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/webp" />
              </div>
              {s?.faviconPath && <label className="check"><input type="checkbox" name="removeFavicon" /> Revenir au favicon par défaut</label>}
            </Group>
            <Group label="Affichage" full>
              <label className="check"><input type="checkbox" name="showMark" defaultChecked={s?.showMark ?? true} /> Afficher le logo (ou la pastille avec l'initiale) à côté du nom</label>
            </Group>
          </div>
          <div className="form-actions"><button className="btn btn-primary">Enregistrer</button></div>
        </Form>
        <h2 style={{ margin: "8px 0 4px" }}>Mentions des factures</h2>
        <p className="muted" style={{ marginBottom: 12 }}>Ces informations figurent sur les factures (mentions légales marocaines).</p>
        <Form action={saveSettings} className="card form">
          <div className="form-grid">
            <Field label="Raison sociale" full><input name="name" defaultValue={f("name")} /></Field>
            <Field label="Adresse"><input name="address" defaultValue={f("address")} /></Field>
            <Field label="Ville"><input name="city" defaultValue={f("city")} /></Field>
            <Field label="Téléphone"><input name="phone" defaultValue={f("phone")} /></Field>
            <Field label="E-mail"><input name="email" defaultValue={f("email")} /></Field>
            <Field label="ICE"><input name="ice" defaultValue={f("ice")} /></Field>
            <Field label="IF"><input name="ifiscal" defaultValue={f("ifiscal")} /></Field>
            <Field label="RC"><input name="rc" defaultValue={f("rc")} /></Field>
            <Field label="Patente"><input name="patente" defaultValue={f("patente")} /></Field>
            <Field label="CNSS"><input name="cnss" defaultValue={f("cnss")} /></Field>
            <Field label="RIB"><input name="rib" defaultValue={f("rib")} /></Field>
            <Field label="TVA par défaut (%)"><input name="vatRate" inputMode="decimal" defaultValue={s ? num(s.vatRate) : 20} /></Field>
            <Field label="Délai de paiement (jours)"><input name="paymentDays" inputMode="numeric" defaultValue={s?.paymentDays ?? 30} /></Field>
          </div>
          <div className="form-actions"><button className="btn btn-primary">Enregistrer</button></div>
        </Form>
      </div>
    </>
  );
}

/** Groupe de champs (div, pas label : il contient plusieurs contrôles). */
function Group({ label, children, full, hint }: { label: string; children: React.ReactNode; full?: boolean; hint?: string }) {
  return (
    <div className={`field${full ? " full" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
