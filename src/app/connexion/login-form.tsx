"use client";

import { useActionState } from "react";
import { login, registerCabinet } from "../actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="form">
      <input name="email" type="email" placeholder="Adresse e-mail" required autoComplete="email" />
      <input name="password" type="password" placeholder="Mot de passe" required autoComplete="current-password" />
      {state?.error && <div className="notice danger">{state.error}</div>}
      <button className="btn btn-primary" disabled={pending} data-pending={pending || undefined}>{pending ? "Connexion…" : "Continuer"}</button>
    </form>
  );
}

export function SetupForm() {
  const [state, action, pending] = useActionState(registerCabinet, undefined);
  return (
    <form action={action} className="form">
      <input name="cabinetName" placeholder="Nom du cabinet" required autoComplete="organization" />
      <input name="name" placeholder="Votre nom complet" required autoComplete="name" />
      <input name="email" type="email" placeholder="Adresse e-mail" required autoComplete="email" />
      <input name="city" placeholder="Ville au Maroc" autoComplete="address-level2" />
      <input name="phone" type="tel" placeholder="Téléphone" autoComplete="tel" />
      <input name="password" type="password" placeholder="Mot de passe (8 caractères minimum)" required minLength={8} autoComplete="new-password" />
      {state?.error && <div className="notice danger">{state.error}</div>}
      <button className="btn btn-primary" disabled={pending} data-pending={pending || undefined}>{pending ? "Création…" : "Créer mon espace cabinet"}</button>
    </form>
  );
}
