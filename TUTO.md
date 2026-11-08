# TUTO — Mettre en ligne et gérer Resale Manager

Le code est sur **GitHub** ; le site, la base de données et les notifications sont chez **Cloudflare**, dans les offres gratuites. Ce tuto part de zéro : à la fin, tu as **ta propre** Resale Manager en ligne, avec ta propre base de données.

**Sommaire**
1. [Comment ça marche](#1-comment-ça-marche)
2. [Première mise en ligne (une seule fois)](#2-première-mise-en-ligne-une-seule-fois)
3. [Installer l'appli sur ton téléphone + notifications](#3-installer-lappli-sur-ton-téléphone--notifications)
4. [Au quotidien : mettre à jour l'appli](#4-au-quotidien--mettre-à-jour-lappli)
5. [Gérer les comptes](#5-gérer-les-comptes)
6. [Tester sur ton ordinateur](#6-tester-sur-ton-ordinateur)
7. [Dépannage](#7-dépannage)

---

## 1. Comment ça marche

| Partie | Où | Rôle |
|---|---|---|
| L'interface | dossier `src/` | Les écrans (Astro + Svelte) |
| Le serveur | dossier `worker/` | Vérifie la connexion, lit/écrit dans la base, envoie les notifications |
| La base de données | Cloudflare **D1** | Les opportunités, le stock, les ventes, les réglages |
| La structure de la base | dossier `migrations/` | Créée automatiquement par une commande |

- Chaque compte ne voit **que ses propres données** : le serveur le vérifie à chaque demande. Tu peux créer plusieurs comptes (par exemple un par personne du foyer).
- Les mots de passe ne sont jamais stockés, seulement une empreinte chiffrée. Après 5 essais ratés, l'identifiant est bloqué 15 minutes.
- Pas d'inscription publique : c'est toi qui crées les comptes avec une commande.

---

## 2. Première mise en ligne (une seule fois)

Avant de commencer, il te faut :
- un compte **GitHub** (gratuit) et un compte **Cloudflare** (gratuit) ;
- **Node.js 22.12 ou plus récent** (https://nodejs.org) et **Git** (https://git-scm.com) installés sur ton ordinateur.

Toutes les commandes se tapent dans un terminal ouvert **dans le dossier du projet** (sous Windows : clic droit dans le dossier → « Ouvrir dans le Terminal »).

### 2.1 Récupérer ta propre copie du projet
1. Sur la page GitHub de ce projet, clique **Use this template → Create a new repository**.
2. Donne-lui un nom (par exemple `resale-manager`), choisis **Private** (conseillé : ce sera ta version à toi), puis **Create repository**.
3. Récupère-la sur ton ordinateur (remplace `ton-pseudo` par ton identifiant GitHub) :
```bash
git clone https://github.com/ton-pseudo/resale-manager.git
```
```bash
cd resale-manager
```
Ta copie est **totalement indépendante** : elle a sa propre base de données, vide, et personne d'autre n'y a accès.

### 2.2 Installer les outils du projet
```bash
npm install
```

### 2.3 Se connecter à Cloudflare depuis ce PC
```bash
npx wrangler login
```
Une page s'ouvre dans ton navigateur : connecte-toi à ton compte Cloudflare et accepte.

### 2.4 Créer ta base de données
```bash
npx wrangler d1 create resale-manager
```
La commande affiche un bloc contenant `"database_id": "xxxxxxxx-xxxx-…"`. Copie cet identifiant et colle-le dans `wrangler.jsonc`, à la place de `REMPLACE-PAR-TON-DATABASE-ID`. Enregistre.

Puis crée les tables (vides) :
```bash
npm run db:remote
```

### 2.5 Créer les clés des notifications
```bash
npm run cles-push
```
- La **clé publique** s'affiche : colle-la dans `wrangler.jsonc`, entre les guillemets de la ligne `"VAPID_PUBLIC_KEY": ""`. Enregistre.
- La **clé privée** est rangée dans le fichier `.dev.vars` de ton PC, qui n'est **jamais** envoyé sur GitHub. Tu l'enverras à Cloudflare à l'étape 2.8.

### 2.6 Envoyer tes réglages sur GitHub
```bash
git add wrangler.jsonc
```
```bash
git commit -m "Mes réglages Cloudflare"
```
```bash
git push
```
Les fichiers personnels (`.dev.vars`, `compte-test.local.txt`) sont exclus automatiquement par `.gitignore`.

### 2.7 Connecter Cloudflare à GitHub
1. https://dash.cloudflare.com → **Workers & Pages** → **Create application** → **Import a repository** → **Get started**.
2. Choisis ton dépôt et configure :
   | Champ | Valeur |
   |---|---|
   | Project name | `resale-manager` (**exactement** comme dans `wrangler.jsonc`) |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` |
   | Production branch | `main` |
3. **Save and Deploy**. Au bout de 1 à 2 minutes, Cloudflare affiche l'adresse de ton site, du type `https://resale-manager.ton-sous-domaine.workers.dev`.
   Recopie cette adresse dans `wrangler.jsonc`, ligne `VAPID_SUBJECT` (à la place de `https://resale-manager.TON-SOUS-DOMAINE.workers.dev`), puis refais `git add wrangler.jsonc`, `git commit -m "Adresse du site"` et `git push`.

### 2.8 Activer l'envoi des notifications
Envoie la clé privée (étape 2.5) à Cloudflare comme **secret** :
```bash
npx wrangler secret put VAPID_PRIVATE_KEY
```
Quand c'est demandé, colle la valeur entre apostrophes de la ligne `VAPID_PRIVATE_KEY='…'` de `.dev.vars` (tout ce qui est entre `{` et `}`, accolades comprises).

### 2.9 Créer ton compte
```bash
npm run compte -- --remote
```
Le script demande l'identifiant (ex. `camille`), le nom affiché (ex. `Camille`) puis le mot de passe (rien ne s'affiche quand tu tapes, c'est normal). **10 caractères minimum.** Recommence pour chaque compte à créer.

### 2.10 Vérifier
Ouvre l'adresse du site, connecte-toi, ajoute une opportunité ou un article : il doit apparaître dans la liste.

---

## 3. Installer l'appli sur ton téléphone + notifications

**iPhone (iOS 16.4 minimum)**
1. Ouvre l'adresse du site dans **Safari**. Chrome ne permet pas les notifications sur iPhone.
2. Bouton **Partager** (carré avec une flèche) → **Sur l'écran d'accueil** → **Ajouter**.
3. Ouvre l'appli **depuis sa nouvelle icône**, puis connecte-toi.
4. **Réglages** (menu « Plus ») → **Notifications de relance** → **Activer sur cet appareil** → **Autoriser**.
5. Touche **Envoyer un test** : une notification doit arriver dans les secondes qui suivent.

**Android**
1. Ouvre l'adresse dans **Chrome** → menu ⋮ → **Ajouter à l'écran d'accueil** (ou **Installer l'application**).
2. Mêmes étapes 3 à 5 que sur iPhone.

Ensuite, chaque matin à **9 h**, tu reçois une notification s'il y a des annonces à relancer, par exemple « 3 annonces à relancer : Lot BD Astérix (15 j), Sac Longchamp (9 j) et 1 autre ». Toucher la notification ouvre directement l'écran Relances. L'icône de l'appli affiche aussi une pastille avec le nombre d'articles à relancer.

Pas de notification les jours où rien n'est à relancer. Se déconnecter sur un téléphone coupe ses notifications.

---

## 4. Au quotidien : mettre à jour l'appli

Après une modification (par toi ou par Claude) :
```bash
git add .
```
```bash
git commit -m "Ce que j'ai changé"
```
```bash
git push
```
Cloudflare remet l'appli à jour tout seul en 1 à 2 minutes (onglet **Deployments**). Tes données ne bougent pas.

**Si une modification change la structure de la base** (nouveau fichier dans `migrations/`), lance aussi, une fois :
```bash
npm run db:remote
```

---

## 5. Gérer les comptes

- **Changer ton mot de passe** : dans l'appli, **Réglages → Compte**. Les autres appareils sont déconnectés.
- **Mot de passe oublié**, ou nouveau compte : relance `npm run compte -- --remote` avec le même identifiant. Le mot de passe est remplacé et les données restent.

---

## 6. Tester sur ton ordinateur

Une base de **test** séparée existe sur ton PC, sans rapport avec celle en ligne.
```bash
npm run db:local
```
```bash
npm run dev:full
```
Crée un compte de test (une seule fois) avec `npm run compte -- --local`, puis ouvre http://localhost:8787.

Pour retoucher seulement le design avec rechargement instantané : `npm run dev` (http://localhost:4321). Il faut alors que `npm run dev:full` tourne aussi pour les données.

---

## 7. Dépannage

| Problème | Solution |
|---|---|
| La construction Cloudflare échoue avec « database_id » | Tu n'as pas remplacé l'identifiant dans `wrangler.jsonc` (étape 2.4). |
| « Réglages introuvables pour ce compte » | Le compte a été créé à la main sans le script : relance `npm run compte -- --remote` pour ce compte. |
| « Trop d'essais. Réessaie dans 15 min. » | Protection contre les devinettes de mot de passe : attends 15 minutes. |
| « Notifications pas encore configurées » | Étapes 2.5 ou 2.8 pas faites, ou `VAPID_PUBLIC_KEY` vide dans `wrangler.jsonc`. |
| Le test de notification échoue | Vérifie l'étape 2.8, puis désactive et réactive les notifications dans Réglages. |
| iPhone : pas de bouton « Activer » | L'appli doit être ouverte depuis l'icône de l'écran d'accueil (ajoutée via Safari), pas dans Safari. |
| « Notifications bloquées » | Réglages du téléphone → Notifications → Resale → Autoriser. |
| Voir les erreurs du serveur | Cloudflare → ton Worker → onglet **Logs**. |
