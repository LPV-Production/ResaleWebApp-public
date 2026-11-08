-- Téléphones / navigateurs abonnés aux notifications de relance (un par appareil)
CREATE TABLE push_subscriptions (
  endpoint    TEXT PRIMARY KEY,                -- adresse fournie par Apple / Google / Mozilla
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX push_user ON push_subscriptions(user_id);
