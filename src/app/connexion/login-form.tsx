"use client";

import { useActionState } from "react";
import { login, setupFirstAdmin } from "../actions/auth";

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
  const [state, action, pending] = useActionState(setupFirstAdmin, undefined);
  return (
    <form action={action} className="form">
      <input name="name" placeholder="Nom complet" required autoComplete="name" />
      <input name="email" type="email" placeholder="Adresse e-mail" required autoComplete="email" />
      <input name="password" type="password" placeholder="Mot de passe (8 caractères minimum)" required minLength={8} autoComplete="new-password" />
      {state?.error && <div className="notice danger">{state.error}</div>}
      <button className="btn btn-primary" disabled={pending} data-pending={pending || undefined}>{pending ? "Création…" : "Créer le compte gérant"}</button>
    </form>
  );
}
