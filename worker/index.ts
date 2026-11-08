// ============================================================
// RESALE MANAGER — serveur (Cloudflare Worker)
// Reçoit les demandes de l'appli (/api/...), vérifie qui est connecté,
// puis lit / écrit dans la base D1. Toutes les requêtes sont filtrées
// par user_id : un compte ne peut jamais toucher aux données d'un autre.
// ============================================================
import { changePassword, currentUser, login, logout, type User } from './auth';
import { clean, HttpError, json, readBody, setClause, todayParis, type FieldType } from './http';
import { sendPush, unb64url, type PushKeys, type Subscription } from './push';

export interface Env extends PushKeys {
  DB: D1Database;
  ASSETS: Fetcher;
}

const REPAIR = ['Non nécessaire', 'À faire', 'En cours', 'Terminée'] as const;
const STATUS = ['En stock', 'Vendu', 'Archivé'] as const;

const OPP_FIELDS: Record<string, FieldType> = {
  name: 'text', brand: 'text', category: 'text', buy_link: 'url', buy_platform: 'text',
  target_buy: 'num', buy_fee: 'num', shipping: 'num', repair: 'num', resale: 'num', notes: 'longtext',
};
const STOCK_FIELDS: Record<string, FieldType> = {
  name: 'text', brand: 'text', category: 'text', buy_platform: 'text', purchase_date: 'date',
  gross: 'num', buy_fee: 'num', shipping: 'num', repair: 'num', repair_status: REPAIR, repair_notes: 'text',
  resale: 'num', resale_platform: 'text', photos: 'url', description: 'longtext',
};
const SALE_FIELDS: Record<string, FieldType> = { sale_date: 'date', platform: 'text', revenue: 'num', shipping: 'num' };
const PARAM_FIELDS: Record<string, FieldType> = { go_margin: 'num', reminder_days: 'int', republish_days: 'int' };

// ---------- Conversion base -> appli ----------
const parseList = (s: unknown) => { try { const v = JSON.parse(String(s)); return Array.isArray(v) ? v : []; } catch { return []; } };
const stockOut = (r: Record<string, unknown>) => ({ ...r, user_id: undefined, published_on: parseList(r.published_on) });
const paramsOut = (r: Record<string, unknown>) => ({ ...r, user_id: undefined, buy_platforms: parseList(r.buy_platforms), resale_platforms: parseList(r.resale_platforms) });
const strip = (r: Record<string, unknown>) => ({ ...r, user_id: undefined });

function platformList(v: unknown) {
  if (!Array.isArray(v) || v.length > 30) throw new HttpError(400, 'Liste de plateformes invalide');
  const seen = new Set<string>();
  return v.map((p) => {
    const name = String(p?.name ?? '').trim().slice(0, 60);
    const prefix = String(p?.prefix ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (!name || !prefix) throw new HttpError(400, 'Chaque plateforme doit avoir un nom et un préfixe');
    if (seen.has(name)) throw new HttpError(400, `Plateforme en double : ${name}`);
    seen.add(name);
    return { name, prefix };
  });
}

// ---------- Routes ----------
async function route(req: Request, env: Env, url: URL): Promise<Response> {
  const db = env.DB;
  const method = req.method;
  const path = url.pathname.replace(/\/+$/, '');

  // Protection contre les requêtes envoyées depuis un autre site
  if (method !== 'GET' && req.headers.get('origin') && req.headers.get('origin') !== url.origin) {
    throw new HttpError(403, 'Origine refusée');
  }

  if (path === '/api/login' && method === 'POST') {
    const body = await readBody(req);
    const { user, cookie } = await login(db, body.id, body.password);
    return json({ user }, 200, { 'set-cookie': cookie });
  }
  if (path === '/api/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': await logout(db, req) });
  }

  // Tout le reste demande d'être connecté
  const user = await currentUser(db, req);
  if (!user) throw new HttpError(401, 'Non connecté');
  const uid = user.id;
  const seg = path.split('/').slice(2); // ex. ['stock', '<id>', 'sell']

  if (path === '/api/me' && method === 'GET') return json({ user });
  if (path === '/api/password' && method === 'POST') {
    const body = await readBody(req);
    await changePassword(db, req, user, body.current, body.next);
    return json({ ok: true });
  }

  // Toutes les données du compte en une fois (chargement de l'appli)
  if (path === '/api/data' && method === 'GET') {
    const [p, o, s, v] = await db.batch([
      db.prepare('SELECT * FROM params WHERE user_id = ?').bind(uid),
      db.prepare('SELECT * FROM opportunities WHERE user_id = ? ORDER BY created_at DESC').bind(uid),
      db.prepare('SELECT * FROM stock WHERE user_id = ? ORDER BY purchase_date DESC, ref DESC').bind(uid),
      db.prepare('SELECT * FROM sales WHERE user_id = ? ORDER BY sale_date DESC').bind(uid),
    ]);
    const params = p.results[0] as Record<string, unknown> | undefined;
    if (!params) throw new HttpError(500, 'Réglages introuvables pour ce compte');
    return json({
      user, today: todayParis(), params: paramsOut(params),
      opportunities: o.results.map((r) => strip(r as Record<string, unknown>)),
      stock: s.results.map((r) => stockOut(r as Record<string, unknown>)),
      sales: v.results.map((r) => strip(r as Record<string, unknown>)),
    });
  }

  // ----- Réglages -----
  if (path === '/api/params' && method === 'PUT') {
    const body = await readBody(req);
    const data: Record<string, string | number> = clean(body, PARAM_FIELDS, true);
    if (data.go_margin !== undefined && Number(data.go_margin) > 10) throw new HttpError(400, 'Seuil de rentabilité invalide');
    if ('buy_platforms' in body) data.buy_platforms = JSON.stringify(platformList(body.buy_platforms));
    if ('resale_platforms' in body) data.resale_platforms = JSON.stringify(platformList(body.resale_platforms));
    if (!Object.keys(data).length) throw new HttpError(400, 'Rien à modifier');
    const set = setClause(data);
    const row = await db.prepare(`UPDATE params SET ${set.sql} WHERE user_id = ? RETURNING *`).bind(...set.values, uid).first();
    return json(paramsOut(row as Record<string, unknown>));
  }

  // ----- Opportunités -----
  if (seg[0] === 'opportunities') {
    const id = seg[1];
    if (!id && method === 'POST') {
      const data = clean(await readBody(req), OPP_FIELDS, false);
      if (!data.name) throw new HttpError(400, 'Le nom est obligatoire');
      const row = await db
        .prepare(`INSERT INTO opportunities (id, user_id, created_at, ${Object.keys(data).join(', ')}) VALUES (?, ?, ?, ${Object.keys(data).map(() => '?').join(', ')}) RETURNING *`)
        .bind(crypto.randomUUID(), uid, new Date().toISOString(), ...Object.values(data))
        .first();
      return json(strip(row!), 201);
    }
    if (id && !seg[2] && method === 'PUT') {
      const data = clean(await readBody(req), OPP_FIELDS, true);
      if (data.name === '') throw new HttpError(400, 'Le nom est obligatoire');
      const set = setClause(data);
      const row = await db.prepare(`UPDATE opportunities SET ${set.sql} WHERE id = ? AND user_id = ? RETURNING *`).bind(...set.values, id, uid).first();
      if (!row) throw new HttpError(404, 'Opportunité introuvable');
      return json(strip(row));
    }
    if (id && !seg[2] && method === 'DELETE') {
      const r = await db.prepare('DELETE FROM opportunities WHERE id = ? AND user_id = ?').bind(id, uid).run();
      if (!r.meta.changes) throw new HttpError(404, 'Opportunité introuvable');
      return json({ ok: true });
    }
    // "J'ai acheté" : tout se fait en une seule opération (référence + article + suppression)
    if (id && seg[2] === 'buy' && method === 'POST') {
      const opp = await db.prepare('SELECT * FROM opportunities WHERE id = ? AND user_id = ?').bind(id, uid).first<Record<string, string | number>>();
      if (!opp) throw new HttpError(404, 'Opportunité introuvable');
      const stockId = crypto.randomUUID();
      const today = todayParis();
      const [, , inserted] = await db.batch([
        db.prepare('UPDATE params SET ref_counter = ref_counter + 1 WHERE user_id = ?').bind(uid),
        db.prepare('DELETE FROM opportunities WHERE id = ? AND user_id = ?').bind(id, uid),
        db.prepare(`
          INSERT INTO stock (id, user_id, ref, purchase_date, name, brand, category, buy_platform, gross, buy_fee, shipping, repair,
                             repair_status, resale, resale_platform, description, last_publication)
          SELECT ?, ?,
            COALESCE((SELECT json_extract(value, '$.prefix') FROM json_each(p.buy_platforms) WHERE json_extract(value, '$.name') = ?), 'AUT')
              || '-' || substr(?, 1, 4) || '-' || printf('%03d', p.ref_counter),
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            COALESCE(json_extract(p.resale_platforms, '$[0].name'), ''), ?, ?
          FROM params p WHERE p.user_id = ?
          RETURNING *`)
          .bind(stockId, uid, opp.buy_platform, today, today, opp.name, opp.brand, opp.category, opp.buy_platform,
            opp.target_buy, opp.buy_fee, opp.shipping, opp.repair, Number(opp.repair) > 0 ? 'À faire' : 'Non nécessaire',
            opp.resale, opp.notes, today, uid),
      ]);
      return json(stockOut(inserted.results[0] as Record<string, unknown>), 201);
    }
  }

  // ----- Stock -----
  if (seg[0] === 'stock') {
    const id = seg[1];
    if (!id && method === 'POST') {
      const data = clean(await readBody(req), STOCK_FIELDS, false);
      if (!data.name) throw new HttpError(400, 'Le nom est obligatoire');
      const keys = Object.keys(data);
      const [, inserted] = await db.batch([
        db.prepare('UPDATE params SET ref_counter = ref_counter + 1 WHERE user_id = ?').bind(uid),
        db.prepare(`
          INSERT INTO stock (id, user_id, ref, last_publication, ${keys.join(', ')})
          SELECT ?, ?,
            COALESCE((SELECT json_extract(value, '$.prefix') FROM json_each(p.buy_platforms) WHERE json_extract(value, '$.name') = ?), 'AUT')
              || '-' || substr(?, 1, 4) || '-' || printf('%03d', p.ref_counter),
            ?, ${keys.map(() => '?').join(', ')}
          FROM params p WHERE p.user_id = ?
          RETURNING *`)
          .bind(crypto.randomUUID(), uid, data.buy_platform, data.purchase_date, todayParis(), ...Object.values(data), uid),
      ]);
      return json(stockOut(inserted.results[0] as Record<string, unknown>), 201);
    }
    if (id && !seg[2] && method === 'PUT') {
      const data = clean(await readBody(req), STOCK_FIELDS, true);
      if (data.name === '') throw new HttpError(400, 'Le nom est obligatoire');
      const set = setClause(data);
      const row = await db.prepare(`UPDATE stock SET ${set.sql} WHERE id = ? AND user_id = ? RETURNING *`).bind(...set.values, id, uid).first();
      if (!row) throw new HttpError(404, 'Article introuvable');
      return json(stockOut(row));
    }
    if (id && !seg[2] && method === 'DELETE') {
      const r = await db.prepare('DELETE FROM stock WHERE id = ? AND user_id = ?').bind(id, uid).run();
      if (!r.meta.changes) throw new HttpError(404, 'Article introuvable');
      return json({ ok: true });
    }
    // Publication : coche/décoche une plateforme. Seule une NOUVELLE publication remet la relance à zéro.
    if (id && seg[2] === 'publish' && method === 'POST') {
      const body = await readBody(req);
      const platform = String(body.platform ?? '').trim();
      const on = body.on === true;
      const item = await db.prepare('SELECT published_on FROM stock WHERE id = ? AND user_id = ?').bind(id, uid).first<{ published_on: string }>();
      if (!item) throw new HttpError(404, 'Article introuvable');
      const list = new Set(parseList(item.published_on) as string[]);
      const isNew = on && !list.has(platform);
      on ? list.add(platform) : list.delete(platform);
      const row = await db
        .prepare(`UPDATE stock SET published_on = ?${isNew ? ', last_publication = ?' : ''} WHERE id = ? AND user_id = ? RETURNING *`)
        .bind(...[JSON.stringify([...list]), ...(isNew ? [todayParis()] : []), id, uid])
        .first();
      return json(stockOut(row!));
    }
    if (id && seg[2] === 'republished' && method === 'POST') {
      const row = await db.prepare('UPDATE stock SET last_publication = ? WHERE id = ? AND user_id = ? RETURNING *').bind(todayParis(), id, uid).first();
      if (!row) throw new HttpError(404, 'Article introuvable');
      return json(stockOut(row));
    }
    if (id && seg[2] === 'status' && method === 'POST') {
      const { status } = clean(await readBody(req), { status: STATUS }, false);
      const row = await db.prepare('UPDATE stock SET status = ? WHERE id = ? AND user_id = ? RETURNING *').bind(status, id, uid).first();
      if (!row) throw new HttpError(404, 'Article introuvable');
      return json(stockOut(row));
    }
    // Vente : création de la vente + passage en "Vendu" en une seule opération
    if (id && seg[2] === 'sell' && method === 'POST') {
      const d = clean(await readBody(req), SALE_FIELDS, false);
      const saleId = crypto.randomUUID();
      const [ins, upd] = await db.batch([
        db.prepare(`
          INSERT INTO sales (id, user_id, stock_id, ref, name, brand, category, purchase_date, sale_date, platform, revenue, shipping,
                             gross, buy_fee, buy_shipping, repair)
          SELECT ?, user_id, id, ref, name, brand, category, purchase_date, ?, ?, ?, ?, gross, buy_fee, shipping, repair
          FROM stock WHERE id = ? AND user_id = ? AND status = 'En stock'
          RETURNING *`).bind(saleId, d.sale_date, d.platform, d.revenue, d.shipping, id, uid),
        db.prepare(`UPDATE stock SET status = 'Vendu' WHERE id = ? AND user_id = ? AND status = 'En stock' RETURNING *`).bind(id, uid),
      ]);
      if (!ins.results.length) throw new HttpError(409, 'Cet article n’est plus en stock');
      return json({ sale: strip(ins.results[0] as Record<string, unknown>), item: stockOut(upd.results[0] as Record<string, unknown>) }, 201);
    }
  }

  // ----- Notifications -----
  if (seg[0] === 'push') {
    if (seg[1] === 'key' && method === 'GET') {
      if (!env.VAPID_PUBLIC_KEY) throw new HttpError(503, 'Notifications pas encore configurées sur le serveur');
      return json({ key: env.VAPID_PUBLIC_KEY });
    }
    if (seg[1] === 'subscribe' && method === 'POST') {
      const sub = readSubscription(await readBody(req));
      // Un appareil = un abonnement ; s'il change de compte, il est rattaché au nouveau
      await db.prepare(`INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth) VALUES (?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`)
        .bind(sub.endpoint, uid, sub.p256dh, sub.auth).run();
      return json({ ok: true }, 201);
    }
    if (seg[1] === 'unsubscribe' && method === 'POST') {
      const endpoint = String((await readBody(req)).endpoint ?? '');
      await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').bind(endpoint, uid).run();
      return json({ ok: true });
    }
    if (seg[1] === 'test' && method === 'POST') {
      const endpoint = String((await readBody(req)).endpoint ?? '');
      const sub = await db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').bind(endpoint, uid).first<Subscription>();
      if (!sub) throw new HttpError(404, 'Cet appareil n’est pas abonné');
      const summary = await relaunchSummary(db, uid);
      const result = await sendPush(sub, {
        title: 'Notifications activées ✓',
        body: summary.count ? `Exemple : ${summary.body}` : 'Tu seras prévenu chaque matin quand une annonce est à relancer.',
        count: summary.count, tag: 'test',
      }, env, url.origin);
      if (result === 'gone') await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
      if (result !== 'ok') throw new HttpError(502, 'Le service de notification a refusé l’envoi');
      return json({ ok: true });
    }
  }

  // ----- Ventes -----
  if (seg[0] === 'sales' && seg[1] && !seg[2] && method === 'DELETE') {
    const r = await db.prepare('DELETE FROM sales WHERE id = ? AND user_id = ?').bind(seg[1], uid).run();
    if (!r.meta.changes) throw new HttpError(404, 'Vente introuvable');
    return json({ ok: true });
  }

  throw new HttpError(404, 'Adresse inconnue');
}

// ---------- Notifications de relance ----------
function readSubscription(body: Record<string, unknown>): Subscription {
  const endpoint = String(body.endpoint ?? '');
  const keys = (body.keys ?? {}) as Record<string, unknown>;
  const p256dh = String(keys.p256dh ?? ''), auth = String(keys.auth ?? '');
  let ok = endpoint.startsWith('https://') && endpoint.length < 1000;
  try { ok &&= unb64url(p256dh).length === 65 && unb64url(auth).length === 16; } catch { ok = false; }
  if (!ok) throw new HttpError(400, 'Abonnement invalide');
  return { endpoint, p256dh, auth };
}

/** Annonces en ligne qui n'ont pas été republiées depuis le délai de relance du compte. */
async function relaunchSummary(db: D1Database, uid: string) {
  const { results } = await db.prepare(`
    SELECT s.name, CAST(julianday(?) - julianday(s.last_publication) AS INTEGER) AS days
    FROM stock s JOIN params p ON p.user_id = s.user_id
    WHERE s.user_id = ? AND s.status = 'En stock' AND s.published_on != '[]'
      AND julianday(?) - julianday(s.last_publication) >= p.reminder_days
    ORDER BY days DESC`).bind(todayParis(), uid, todayParis()).all<{ name: string; days: number }>();
  const n = results.length;
  const names = results.slice(0, 2).map((r) => `${r.name} (${r.days} j)`).join(', ');
  return {
    count: n,
    title: n === 1 ? '1 annonce à relancer' : `${n} annonces à relancer`,
    body: n > 2 ? `${names} et ${n - 2} autre${n > 3 ? 's' : ''}` : names,
  };
}

/** Chaque matin : une notification par appareil abonné, seulement s'il y a quelque chose à relancer. */
async function sendDailyReminders(env: Env) {
  const { results: subs } = await env.DB.prepare('SELECT endpoint, user_id, p256dh, auth FROM push_subscriptions').all<Subscription & { user_id: string }>();
  const byUser = new Map<string, Awaited<ReturnType<typeof relaunchSummary>>>();
  for (const sub of subs) {
    try {
      if (!byUser.has(sub.user_id)) byUser.set(sub.user_id, await relaunchSummary(env.DB, sub.user_id));
      const s = byUser.get(sub.user_id)!;
      if (!s.count) continue;
      const r = await sendPush(sub, { title: s.title, body: s.body, count: s.count, url: '/?vue=relances' }, env, env.VAPID_SUBJECT || '');
      if (r === 'gone') await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
    } catch (e) {
      console.error('Relance non envoyée', sub.user_id, e); // un appareil en erreur ne bloque pas les autres
    }
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      return await route(req, env, url);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Erreur du serveur' }, 500);
    }
  },

  // Déclenché par Cloudflare à 7 h et 8 h UTC : on n'envoie qu'à 9 h, heure de Paris (été comme hiver)
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    // « 09 h » → 9 (on ne garde que les chiffres)
    const hour = Number(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric' }).format(new Date()).replace(/\D/g, ''));
    if (hour !== 9 || !env.VAPID_PRIVATE_KEY) return;
    ctx.waitUntil(sendDailyReminders(env));
  },
} satisfies ExportedHandler<Env>;

export type { User };
