import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { SetupForm } from "../connexion/login-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getUser()) redirect("/");
  return (
    <div className="auth">
      <div className="auth-box">
        <div className="brand-mark" style={{ width: 44, height: 44, margin: "0 auto", fontSize: 18 }}>M</div>
        <h1>Créer votre espace</h1>
        <p className="muted">14 jours d’essai pour organiser votre cabinet d’architecture.</p>
        <SetupForm />
        <p className="muted" style={{ textAlign: "center", marginTop: 20 }}>
          Vous avez déjà un compte ? <Link href="/connexion">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
