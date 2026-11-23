# MyAppFlow

Deux parties dans le même dépôt, déployées ensemble sur Vercel :

- **La vitrine** (`/`) : landing page statique pour les prospects rencontrés en salon (accès via QR code). HTML / CSS / JS sans build : `index.html`, `css/`, `js/`, `images/`.
- **L'espace client** (`/espace`) : portail où chaque client se connecte avec l'identifiant et le mot de passe envoyés par Clément, et retrouve ses projets, devis, factures et contrats. Clément administre tout depuis le même portail (compte administrateur).

## Espace client : en bref

| | |
|---|---|
| Interface | React + TypeScript + Vite (`espace/`) |
| Données, connexion, fichiers | Supabase : PostgreSQL, Auth, Storage (`supabase/migrations/`) |
| Gestion des accès | Fonction serverless Vercel `api/admin-users.js` (seule à utiliser la clé secrète Supabase) |
| PDF | Générés dans le navigateur (jsPDF) ou PDF déposé par l'administrateur |

**Sécurité** : chaque table est protégée par des règles RLS. Un client ne lit que sa société, ses projets et les documents publiés (ni brouillons ni documents masqués). Il ne peut rien modifier, sauf deux actions contrôlées côté base : déposer un devis signé et déclarer un règlement. Les fichiers sont dans un bucket privé.

**Identifiants** : Supabase Auth exige un e-mail ; l'identifiant `telencia` correspond en interne à `telencia@espace.myappflow.local`. Aucun e-mail n'est envoyé.

## Développement local

```bash
npm install
npx supabase start          # base locale (Docker requis), applique la migration
cp .env.example .env.local  # puis y coller les clés affichées par « supabase start »
node --env-file=.env.local scripts/create-admin.mjs clement "MotDePasseAdmin" "Clément Simon"
npm run dev                 # http://localhost:5173/espace/
```

Tests : `npm test` (calculs, identifiants). Les règles de sécurité SQL se testent sur un PostgreSQL simple avec `supabase/rls-tests/` (voir l'en-tête de `rls_test.sql`).

## Mise en ligne

Voir [docs/MISE-EN-LIGNE.md](docs/MISE-EN-LIGNE.md).

## Reprise des données de l'ancien site

`scripts/import-portfolio.mjs` importe un client, son projet et ses documents (avec leurs PDF d'origine) à partir d'un fichier manifest JSON. Ce manifest contient des données client : il ne doit jamais être committé (le dépôt est public).
