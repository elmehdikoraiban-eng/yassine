import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBrand } from "@/lib/brand";
import { LoginForm, SetupForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  const [count, brand] = await Promise.all([prisma.user.count(), getBrand()]);
  const firstRun = count === 0;
  return (
    <div className="auth">
      <div className="auth-box">
        {brand.logo ? (
          <img src={brand.logo} alt={brand.name} style={{ width: 56, height: 56, objectFit: "contain", margin: "0 auto", display: "block" }} />
        ) : (
          <div className="brand-mark" style={{ width: 44, height: 44, margin: "0 auto", fontSize: 18 }}>{brand.name.trim()[0]?.toUpperCase()}</div>
        )}
        <h1>{firstRun ? "Bienvenue" : "Bon retour"}</h1>
        <p className="muted">{firstRun ? "Créez le compte de l'architecte gérant pour démarrer." : `Connectez-vous à la plateforme ${brand.name}.`}</p>
        {firstRun ? <SetupForm /> : <LoginForm />}
      </div>
    </div>
  );
}
