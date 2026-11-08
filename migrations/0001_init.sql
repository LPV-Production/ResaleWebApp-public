-- ============================================================
-- RESALE MANAGER — structure de la base de données (Cloudflare D1)
-- Appliquée automatiquement par :  npx wrangler d1 migrations apply resale-manager --remote
-- Chaque table a une colonne user_id : chaque compte ne voit QUE ses données
-- (le serveur ajoute "WHERE user_id = ..." à toutes les requêtes).
-- ============================================================

-- Comptes. Le mot de passe n'est jamais stocké : seulement une empreinte.
CREATE TABLE users (
  id            TEXT PRIMARY KEY,            -- identifiant de connexion, ex. 'camille'
  label         TEXT NOT NULL,               -- nom affiché, ex. 'Camille'
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sessions de connexion (un appareil connecté = une session)
CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,              -- empreinte du jeton (le jeton lui-même reste dans le cookie)
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL               -- en millisecondes
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Anti-devinette de mot de passe : blocage après plusieurs échecs
CREATE TABLE login_attempts (
  key       TEXT PRIMARY KEY,
  count     INTEGER NOT NULL,
  first_at  INTEGER NOT NULL
);

-- Réglages (une ligne par compte)
CREATE TABLE params (
  user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  go_margin        REAL NOT NULL DEFAULT 0.15,
  reminder_days    INTEGER NOT NULL DEFAULT 5,
  republish_days   INTEGER NOT NULL DEFAULT 7,
  buy_platforms    TEXT NOT NULL DEFAULT '[{"name":"Vinted","prefix":"VIN"},{"name":"Leboncoin","prefix":"LBC"},{"name":"Emmaüs","prefix":"EMM"},{"name":"Vide-grenier","prefix":"VG"},{"name":"Autre","prefix":"AUT"}]',
  resale_platforms TEXT NOT NULL DEFAULT '[{"name":"Vinted","prefix":"VIN"},{"name":"Leboncoin","prefix":"LBC"},{"name":"Facebook Marketplace","prefix":"FB"},{"name":"Autre","prefix":"AUT"}]',
  ref_counter      INTEGER NOT NULL DEFAULT 0
);

-- Opportunités (annonces repérées, pas encore achetées)
CREATE TABLE opportunities (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  name         TEXT NOT NULL,
  brand        TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT '',
  buy_link     TEXT NOT NULL DEFAULT '',
  buy_platform TEXT NOT NULL DEFAULT '',
  target_buy   REAL NOT NULL DEFAULT 0,
  buy_fee      REAL NOT NULL DEFAULT 0,       -- fraction (0.05 = 5 %)
  shipping     REAL NOT NULL DEFAULT 0,
  repair       REAL NOT NULL DEFAULT 0,
  resale       REAL NOT NULL DEFAULT 0,
  notes        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX opportunities_user ON opportunities(user_id);

-- Stock (articles achetés)
CREATE TABLE stock (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ref              TEXT NOT NULL,
  purchase_date    TEXT NOT NULL,
  name             TEXT NOT NULL,
  brand            TEXT NOT NULL DEFAULT '',
  category         TEXT NOT NULL DEFAULT '',
  buy_platform     TEXT NOT NULL DEFAULT '',
  gross            REAL NOT NULL DEFAULT 0,
  buy_fee          REAL NOT NULL DEFAULT 0,
  shipping         REAL NOT NULL DEFAULT 0,
  repair           REAL NOT NULL DEFAULT 0,
  repair_status    TEXT NOT NULL DEFAULT 'Non nécessaire',
  repair_notes     TEXT NOT NULL DEFAULT '',
  resale           REAL NOT NULL DEFAULT 0,
  resale_platform  TEXT NOT NULL DEFAULT '',
  photos           TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'En stock',   -- En stock / Vendu / Archivé
  published_on     TEXT NOT NULL DEFAULT '[]',         -- liste JSON des plateformes où l'annonce est en ligne
  last_publication TEXT NOT NULL,
  UNIQUE (user_id, ref)
);
CREATE INDEX stock_user ON stock(user_id);

-- Ventes (copie figée des coûts au moment de la vente)
CREATE TABLE sales (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stock_id      TEXT REFERENCES stock(id) ON DELETE SET NULL,
  ref           TEXT NOT NULL DEFAULT '',
  name          TEXT NOT NULL DEFAULT '',
  brand         TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT '',
  purchase_date TEXT NOT NULL DEFAULT '',
  sale_date     TEXT NOT NULL,
  platform      TEXT NOT NULL DEFAULT '',
  revenue       REAL NOT NULL DEFAULT 0,
  shipping      REAL NOT NULL DEFAULT 0,      -- frais d'envoi payés par le vendeur
  gross         REAL NOT NULL DEFAULT 0,
  buy_fee       REAL NOT NULL DEFAULT 0,
  buy_shipping  REAL NOT NULL DEFAULT 0,
  repair        REAL NOT NULL DEFAULT 0
);
CREATE INDEX sales_user ON sales(user_id);
