"use client";

import { Form } from "@/components/form";
import { updatePlatformCabinet } from "@/app/actions/admin";

export function CabinetControls({ cabinet }: { cabinet: { id: string; status: string } }) {
  return (
    <details style={{ marginTop: 18 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>Gérer l’accès au cabinet</summary>
      <Form action={updatePlatformCabinet} className="form" style={{ marginTop: 14 }}>
        <input type="hidden" name="cabinetId" value={cabinet.id} />
        <label className="field"><span>Accès</span>
          <select name="status" defaultValue={cabinet.status}>
            <option value="ACTIVE">Actif</option><option value="SUSPENDED">Suspendu</option>
          </select>
        </label>
        <p className="faint">La plateforme est gratuite pour tous les cabinets. Cette action sert uniquement à suspendre ou réactiver un espace.</p>
        <button className="btn btn-primary">Enregistrer</button>
      </Form>
    </details>
  );
}

