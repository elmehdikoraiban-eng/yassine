"use client";

import { useActionState, useRef } from "react";
import type { ActionResult } from "@/lib/action";

/**
 * Formulaire relié à une action serveur, qui affiche l'erreur éventuelle sous les champs.
 * Pendant l'envoi, les boutons sont bloqués : un double clic n'enregistre pas deux fois
 * (règlement, facture, étape…).
 */
export function Form({
  action, children, className, style,
}: {
  action: (fd: FormData) => Promise<unknown>;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const inFlight = useRef(false);
  const skip = useRef(0);
  // Les envois sont mis en file par React : on compte ceux faits pendant qu'un envoi est en cours
  // pour les ignorer ensuite.
  const onSubmitCapture = () => {
    if (inFlight.current) skip.current++;
    else inFlight.current = true;
  };
  const [state, formAction, pending] = useActionState(async (prev: ActionResult, fd: FormData) => {
    if (skip.current > 0) {
      skip.current--;
      return prev;
    }
    try {
      return ((await action(fd)) as ActionResult) ?? undefined;
    } finally {
      inFlight.current = false;
    }
  }, undefined);
  return (
    <form action={formAction} onSubmitCapture={onSubmitCapture} className={className} style={style} aria-busy={pending || undefined}>
      {children}
      {state?.error && <div className="notice danger" role="alert" style={{ flexBasis: "100%" }}>{state.error}</div>}
    </form>
  );
}
