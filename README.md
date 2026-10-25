# Plateforme de gestion du cabinet d'architecture

Application web qui couvre les lots 1 à 3 : gestion des clients, projets, documents, devis, factures, règlements et équipe.

La plateforme est conçue en mode SaaS multi-cabinets. Chaque compte appartient à un cabinet ; les requêtes de l'application sont automatiquement limitées à son espace. L'administrateur plateforme consulte l'ensemble des cabinets, membres et projets depuis `/admin`.

## Technique

Next.js 15 (App Router) · TypeScript · PostgreSQL via Prisma · sessions JWT en cookie httpOnly · mots de passe bcrypt · fichiers sur Vercel Blob.

## Démarrer

```bash
cp .env.example .env
# Définir AUTH_SECRET avec une valeur aléatoire longue.
# Ajouter l'adresse administrateur dans PLATFORM_ADMIN_EMAILS.
npm install
npm run dev
```

Créez ensuite un cabinet depuis `/inscription`. L'inscription crée l'espace, le compte gérant et 14 jours d'essai.

Configurez `SUPABASE_DATABASE_URL` avec le pooler de transaction Supabase (6543) pour le runtime et `SUPABASE_DIRECT_URL` pour les migrations et opérations Prisma. Le build Vercel ne modifie plus le schéma automatiquement ; appliquez les migrations SQL explicitement. Les fichiers métier restent stockés dans Vercel Blob.

## Sécurité et configuration

- Configurez `AUTH_SECRET` comme un secret long et aléatoire.
- Configurez `PLATFORM_ADMIN_EMAILS` côté serveur (liste d'adresses séparées par des virgules). Ne pas exposer cette variable au navigateur.
- Ne connectez pas directement la clé Supabase publique à ces tables : l'application utilise Prisma côté serveur.
- Les migrations de production se font explicitement, jamais pendant le build.
