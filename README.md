# Resale Manager

Appli de suivi achat / revente (Vinted, Leboncoin, Facebook Marketplace…) : opportunités, stock, ventes, relances, avec des notifications sur téléphone.

- **Interface** : Astro + Svelte (`src/`)
- **Serveur** : Cloudflare Worker (`worker/`) : connexion, API, notifications
- **Base de données** : Cloudflare D1 (`migrations/`)
- **Hébergement** : Cloudflare, mis à jour automatiquement à chaque `git push`

👉 **Pour avoir ta propre version en ligne** (gratuit, avec ta propre base de données) : suis **[TUTO.md](TUTO.md)**.

| Commande | Rôle |
|---|---|
| `npm run dev:full` | Lance l'appli complète sur ce PC (http://localhost:8787) |
| `npm run dev` | Interface seule, rechargement instantané (http://localhost:4321) |
| `npm run db:local` / `db:remote` | Crée ou met à jour les tables (test / en ligne) |
| `npm run compte -- --remote` | Crée un compte ou change son mot de passe |
| `npm run cles-push` | Génère les clés des notifications (une seule fois) |

## Licence

[MIT](LICENSE) : tu peux reprendre, modifier et partager ce projet librement, y compris pour un usage commercial, en gardant la mention de licence.
