# Mettre en ligne l'espace client

Tant que ces étapes ne sont pas faites, `/espace` affiche « L'espace client n'est pas encore configuré » et la vitrine fonctionne normalement.

## 1. Créer le projet Supabase (5 min)

1. Sur [supabase.com](https://supabase.com), créer un projet **myappflow**, région **Europe (Paris ou Francfort)**.
2. *SQL Editor* : coller tout le contenu de `supabase/migrations/20261123000000_espace_client.sql`, puis *Run*.
3. *Authentication → Sign In / Providers* : **désactiver « Allow new users to sign up »** (seul l'administrateur crée les comptes) et désactiver « Confirm email ».
4. *Authentication → Policies (ou Passwords)* : longueur minimale du mot de passe **10**.
5. *Project Settings → API* : noter l'**URL du projet**, la clé **anon / publishable** et la clé **service_role / secret** (cette dernière ne doit jamais être partagée ni committée).

## 2. Configurer Vercel

Le plus simple : *Vercel → projet myappflow → Storage (ou Integrations) → Supabase → Connect* et choisir le projet Supabase `myappflow`. Vercel ajoute alors seul `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`, que l'espace sait lire. Sinon, ajouter les variables à la main :

*Vercel → projet myappflow → Settings → Environment Variables* (Production et Preview) :

| Nom | Valeur |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | clé anon / publishable |
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service_role / secret |

Le fichier `vercel.json` indique déjà la commande de build (`npm run build`) et le dossier publié (`dist`). Redéployer après avoir ajouté les variables.

## 3. Créer le compte administrateur

Depuis un ordinateur avec Node 20+ et ce dépôt :

```bash
npm install
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-admin.mjs clement "UnMotDePasseLong" "Clément Simon"
```

Puis se connecter sur `https://myappflow.vercel.app/espace` et remplir **Réglages** (émetteur, IBAN, signature).

## 4. Reprendre les données de l'ancien site (facultatif)

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-portfolio.mjs chemin/vers/manifest.json --dry-run   # vérifier
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-portfolio.mjs chemin/vers/manifest.json             # importer
```

## 5. Donner l'accès à un client

*Clients → le client → Accès à l'espace client* : saisir un identifiant, cliquer sur « Créer l'accès ». Le message à envoyer (adresse, identifiant, mot de passe provisoire) s'affiche une seule fois. Le client choisit son propre mot de passe à la première connexion.
