# Plateforme de gestion du cabinet d'architecture

Application web qui couvre les **lots 1 à 3** du cahier des charges :

- **Lot 1, socle** : comptes et profils (gérant, assistante, technicien, collaborateur), fiches clients avec historique des échanges, projets avec référence automatique, suivi des 20 étapes du processus (§5), équipe affectée, intervenants (BET, entreprise, bureau de contrôle…), journal de traçabilité, recherche transversale, tableau de bord.
- **Lot 2, documents** : arborescence type du dossier (§11, 15 dossiers), dépôt de fichiers, versions à indices A, B, C… sans perte d'historique, états (travail, validé, obsolète), plans d'exécution avec leur état (à préparer → diffusé → révisé), diffusion tracée aux intervenants, téléchargement contrôlé par les droits.
- **Lot 3, finances** : contrat d'honoraires HT/TVA/TTC avec avenants tracés, échéancier lié aux étapes (20/20/20/20/10/10 par défaut, modifiable), vue avancement × finances (§18), factures (brouillon → émise, numérotation continue FA-AAAA-NNNN, annulation motivée, jamais de suppression d'une facture émise), règlements partiels, reste dû, retards, relances, impression PDF avec ICE/IF/RC/patente et montant en lettres.

Le style visuel reprend celui de l'interface ChatGPT : barre latérale grise avec les projets récents, contenu blanc, boutons pilules noirs, barre de recherche façon zone de saisie, accent vert OpenAI, mode sombre automatique, utilisable sur téléphone.

## Technique

Next.js 15 (App Router, actions serveur) · TypeScript · PostgreSQL via Prisma · sessions JWT en cookie httpOnly · mots de passe bcrypt · fichiers sur disque (`STORAGE_DIR`), à remplacer par un stockage objet S3 en production (`src/lib/storage.ts`).

## Démarrer

```bash
cp .env.example .env            # puis changer AUTH_SECRET
docker compose up -d            # ou une base PostgreSQL existante (DATABASE_URL)
npm install
npm run db:push                 # crée les tables
npm run db:seed                 # données de démonstration (facultatif)
npm run dev                     # http://localhost:3000
```

Comptes de démonstration (mot de passe `cabinet2026`) : `gerant@cabinet.ma`, `assistante@cabinet.ma`, `technicien@cabinet.ma`, `collaborateur@cabinet.ma`.

## Choix par défaut à valider avec le cabinet

Le cahier des charges laisse ces points ouverts ; ils sont réglés de façon raisonnable et faciles à changer :

| Sujet | Valeur retenue | Où la changer |
|---|---|---|
| Droits | Finances réservées au gérant et à l'assistante. Technicien et collaborateur ne voient que leurs projets affectés et pas les dossiers 02, 13, 14. Seul le gérant valide un document, annule une facture, gère les comptes. | `src/lib/permissions.ts` (matrice affichée dans « Équipe et droits ») |
| Numérotation | Projets `P-2026-001`, factures `FA-2026-0001`, attribuée à l'émission, continue par année | `src/lib/access.ts` |
| TVA et délai | 20 %, paiement à 30 jours | Paramètres |
| Avoirs | Pas d'avoir : une facture émise sans règlement s'annule avec motif, son numéro reste attribué | lot ultérieur |
| Indices de révision | A, B, C… ; une nouvelle version repasse le document « en travail » et un plan validé ou diffusé en « révisé » | `src/app/actions/documents.ts` |
| Diffusion | La plateforme trace la transmission ; l'envoi (e-mail, lien) n'est pas automatisé | lot 4 |
| Accès externes | Pas de portail client/BET : les tiers ne se connectent pas | à décider au cadrage |
| Stockage des plans | Sur le serveur de l'application, sans visionneuse CAO | `src/lib/storage.ts` |

## Hors périmètre (lots suivants)

Lot 4 tâches, alertes et chantier (CR, réserves, photos) · Lot 5 achats, dépenses et dossier trimestriel pour le comptable · Lot 6 qualité ISO 9001 (non-conformités, actions correctives, satisfaction) · modèles de documents (§23).

## Production

Changer `AUTH_SECRET`, servir en HTTPS, sauvegarder chaque jour la base (`pg_dump`) et le dossier `STORAGE_DIR`, et tester la restauration.
