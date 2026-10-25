// Au déploiement : crée ou met à jour les tables si une base est configurée.
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
if (!url) {
  console.log("DATABASE_URL absent : création des tables ignorée.");
} else {
  execSync("npx prisma db push --skip-generate", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
