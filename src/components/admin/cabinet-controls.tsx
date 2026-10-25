"use client";

import { Form } from "@/components/form";
import { inputDate } from "@/lib/format";
import { updatePlatformCabinet } from "@/app/actions/admin";

type CabinetControlData = {
  id: string;
  status: string;
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  subscriptionStartedAt: Date | null;
  subscriptionRenewsAt: Date | null;
  lastPaymentAt: Date | null;
};

export function CabinetControls({ cabinet }: { cabinet: CabinetControlData }) {
  return (
    <details style={{ marginTop: 18 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>Gérer le cabinet et son abonnement</summary>
      <Form action={updatePlatformCabinet} className="form" style={{ marginTop: 14 }}>
        <input type="hidden" name="cabinetId" value={cabinet.id} />
        <div className="form-grid">
          <label className="field"><span>Accès au cabinet</span>
            <select name="status" defaultValue={cabinet.status}>
              <option value="ACTIVE">Actif</option><option value="SUSPENDED">Suspendu</option>
            </select>
          </label>
          <label className="field"><span>Formule</span>
            <select name="plan" defaultValue={cabinet.plan}>
              <option value="TRIAL">Essai</option><option value="STARTER">Starter</option><option value="PRO">Pro</option><option value="BUSINESS">Business</option>
            </select>
          </label>
          <label className="field"><span>État du paiement</span>
            <select name="subscriptionStatus" defaultValue={cabinet.subscriptionStatus}>
              <option value="TRIAL">Essai</option><option value="ACTIVE">À jour</option><option value="PAST_DUE">En retard</option><option value="CANCELED">Résilié</option>
            </select>
          </label>
          <label className="field"><span>Fin de l’essai</span>
            <input type="date" name="trialEndsAt" defaultValue={inputDate(cabinet.trialEndsAt)} />
          </label>
          <label className="field"><span>Début d’abonnement</span>
            <input type="date" name="subscriptionStartedAt" defaultValue={inputDate(cabinet.subscriptionStartedAt)} />
          </label>
          <label className="field"><span>Prochain renouvellement</span>
            <input type="date" name="subscriptionRenewsAt" defaultValue={inputDate(cabinet.subscriptionRenewsAt)} />
          </label>
          <label className="field"><span>Dernier paiement reçu</span>
            <input type="date" name="lastPaymentAt" defaultValue={inputDate(cabinet.lastPaymentAt)} />
          </label>
        </div>
        <p className="faint">Suivi manuel des paiements : aucun prélèvement n’est effectué par cette page.</p>
        <button className="btn btn-primary">Enregistrer</button>
      </Form>
    </details>
  );
}

