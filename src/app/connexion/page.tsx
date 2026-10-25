import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  return (
    <div className="auth">
      <div className="auth-box">
        <div className="brand-mark" style={{ width: 44, height: 44, margin: "0 auto", fontSize: 18 }}>M</div>
        <h1>Bon retour</h1>
        <p className="muted">Connectez-vous à votre espace cabinet.</p>
        <LoginForm />
        <p className="muted" style={{ textAlign: "center", marginTop: 20 }}>
          Vous découvrez la plateforme ? <Link href="/inscription">Créer un espace cabinet</Link>
        </p>
      </div>
    </div>
  );
}
