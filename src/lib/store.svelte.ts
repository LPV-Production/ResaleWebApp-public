// ============================================================
// État de l'appli (ce qui est affiché) + actions.
// Chaque action envoie la demande au serveur, puis met l'écran à jour
// avec la réponse : ce qui est affiché = ce qui est réellement enregistré.
// ============================================================
import { api, ApiError, setUnauthorizedHandler } from './api';
import { disablePush } from './push';
import { calcSale, costOf, todayISO, type Opportunity, type Params, type Sale, type StockItem } from './calc';

export type View = 'dashboard' | 'opportunities' | 'stock' | 'sales' | 'reminders' | 'settings';
export type Modal =
  | { kind: 'opp'; id?: string }
  | { kind: 'stock'; id?: string }
  | { kind: 'sale'; id: string }
  | null;
export type User = { id: string; label: string };

const emptyParams: Params = { go_margin: 0.15, reminder_days: 5, republish_days: 7, buy_platforms: [], resale_platforms: [], ref_counter: 0 };

export const app = $state({
  phase: 'loading' as 'loading' | 'login' | 'ready' | 'error',
  loadError: '',
  user: null as User | null,
  view: 'dashboard' as View,
  params: emptyParams,
  opportunities: [] as Opportunity[],
  stock: [] as StockItem[],
  sales: [] as Sale[],
  selectedId: null as string | null,
  modal: null as Modal,
  busy: false,
  toast: null as { msg: string; error?: boolean } | null,
});

/* ---------- Messages ---------- */
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string, error = false) {
  app.toast = { msg, error };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (app.toast = null), error ? 5000 : 3200);
}

/** Exécute une action serveur : bloque les doubles clics et affiche l'erreur s'il y en a une. */
async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
  if (app.busy) return;
  app.busy = true;
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401)) toast(e instanceof Error ? e.message : 'Erreur inattendue', true);
  } finally {
    app.busy = false;
  }
}

/* ---------- Démarrage, connexion ---------- */
function resetData() {
  app.params = emptyParams;
  app.opportunities = [];
  app.stock = [];
  app.sales = [];
  app.selectedId = null;
  app.modal = null;
}

setUnauthorizedHandler(() => {
  resetData();
  app.user = null;
  app.phase = 'login';
});

type DataResponse = { user: User; params: Params; opportunities: Opportunity[]; stock: StockItem[]; sales: Sale[] };

export async function loadAll() {
  try {
    const d = await api<DataResponse>('GET', '/data');
    app.user = d.user;
    app.params = d.params;
    app.opportunities = d.opportunities;
    app.stock = d.stock;
    app.sales = d.sales;
    // Ouverture depuis une notification : ?vue=relances
    const vue = new URLSearchParams(location.search).get('vue');
    if (vue === 'relances') app.view = 'reminders';
    if (vue) history.replaceState(null, '', '/');
    app.phase = 'ready';
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return; // écran de connexion déjà affiché
    app.loadError = e instanceof Error ? e.message : String(e);
    app.phase = 'error';
  }
}

export async function signIn(id: string, password: string): Promise<string | null> {
  try {
    await api('POST', '/login', { id, password });
    app.phase = 'loading';
    await loadAll();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Connexion impossible';
  }
}

export async function signOut() {
  // Ce téléphone ne doit plus recevoir les notifications de ce compte
  await disablePush().catch(() => {});
  try { await api('POST', '/logout'); } catch {}
  resetData();
  app.user = null;
  app.view = 'dashboard';
  app.phase = 'login';
}

export async function changePassword(current: string, next: string) {
  const ok = await run(() => api('POST', '/password', { current, next }));
  if (ok) toast('Mot de passe modifié. Les autres appareils ont été déconnectés.');
  return !!ok;
}

/* ---------- Navigation, fiches, fenêtres ---------- */
export function go(view: View) {
  app.view = view;
  app.selectedId = null;
  if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
}
export const openItem = (id: string) => (app.selectedId = id);
export const closeItem = () => (app.selectedId = null);
export const openOppForm = (id?: string) => (app.modal = { kind: 'opp', id });
export const openStockForm = (id?: string) => (app.modal = { kind: 'stock', id });
export const openSaleForm = (id: string) => (app.modal = { kind: 'sale', id });
export const closeModal = () => (app.modal = null);

/** Remplace un article du stock par sa version renvoyée par le serveur. */
function putStock(item: StockItem) {
  const i = app.stock.findIndex((s) => s.id === item.id);
  if (i >= 0) app.stock[i] = item;
  else app.stock = [item, ...app.stock];
}

/* ---------- Opportunités ---------- */
export async function saveOpportunity(data: Omit<Opportunity, 'id' | 'created_at'>, id?: string) {
  await run(async () => {
    if (id) {
      const o = await api<Opportunity>('PUT', `/opportunities/${id}`, data);
      app.opportunities = app.opportunities.map((x) => (x.id === id ? o : x));
      toast('Opportunité modifiée');
    } else {
      const o = await api<Opportunity>('POST', '/opportunities', data);
      app.opportunities = [o, ...app.opportunities];
      toast('Opportunité ajoutée');
    }
    closeModal();
  });
}

export async function deleteOpportunity(id: string) {
  if (!confirm('Supprimer cette opportunité ?')) return;
  await run(async () => {
    await api('DELETE', `/opportunities/${id}`);
    app.opportunities = app.opportunities.filter((o) => o.id !== id);
    toast('Opportunité supprimée');
  });
}

/** "J'ai acheté" : l'opportunité devient un article du stock. */
export async function buyOpportunity(id: string) {
  await run(async () => {
    const item = await api<StockItem>('POST', `/opportunities/${id}/buy`);
    app.opportunities = app.opportunities.filter((x) => x.id !== id);
    putStock(item);
    toast(`Ajouté au stock (${item.ref})`);
  });
}

/* ---------- Stock ---------- */
export type StockForm = Pick<StockItem,
  'name' | 'brand' | 'category' | 'buy_platform' | 'purchase_date' | 'gross' | 'buy_fee' | 'shipping' | 'repair' |
  'repair_status' | 'repair_notes' | 'resale' | 'resale_platform' | 'photos' | 'description'>;

export async function saveStock(data: StockForm, id?: string) {
  await run(async () => {
    const item = await api<StockItem>(id ? 'PUT' : 'POST', id ? `/stock/${id}` : '/stock', data);
    putStock(item);
    toast(id ? 'Article modifié' : `Article ajouté (${item.ref})`);
    closeModal();
  });
}

/** Coche / décoche une plateforme. Seule une NOUVELLE publication remet le compteur de relance à zéro. */
export async function togglePublish(id: string, platform: string) {
  const s = app.stock.find((x) => x.id === id);
  if (!s) return;
  await run(async () => putStock(await api<StockItem>('POST', `/stock/${id}/publish`, { platform, on: !s.published_on.includes(platform) })));
}

export async function markRepublished(id: string) {
  await run(async () => {
    putStock(await api<StockItem>('POST', `/stock/${id}/republished`));
    toast('Marqué comme republié aujourd’hui');
  });
}

export async function archiveItem(id: string) {
  await run(async () => {
    putStock(await api<StockItem>('POST', `/stock/${id}/status`, { status: 'Archivé' }));
    toast('Article archivé');
  });
}

export async function restoreItem(id: string) {
  await run(async () => {
    putStock(await api<StockItem>('POST', `/stock/${id}/status`, { status: 'En stock' }));
    toast('Article remis en stock');
  });
}

export async function deleteItem(id: string) {
  if (!confirm('Supprimer définitivement cet article du stock ?')) return;
  await run(async () => {
    await api('DELETE', `/stock/${id}`);
    app.stock = app.stock.filter((s) => s.id !== id);
    app.selectedId = null;
    toast('Article supprimé');
  });
}

/* ---------- Ventes ---------- */
export async function recordSale(stockId: string, d: { sale_date: string; platform: string; revenue: number; shipping: number }) {
  await run(async () => {
    const r = await api<{ sale: Sale; item: StockItem }>('POST', `/stock/${stockId}/sell`, d);
    app.sales = [r.sale, ...app.sales];
    putStock(r.item);
    app.selectedId = null;
    closeModal();
    const profit = calcSale(r.sale).profit;
    toast(`Vente enregistrée · ${profit >= 0 ? '+' : ''}${profit.toFixed(2).replace('.', ',')} €`);
  });
}

export async function deleteSale(id: string) {
  if (!confirm('Supprimer cette vente de l’historique ? L’article restera marqué « Vendu ».')) return;
  await run(async () => {
    await api('DELETE', `/sales/${id}`);
    app.sales = app.sales.filter((s) => s.id !== id);
    toast('Vente supprimée');
  });
}

/* ---------- Réglages ---------- */
export async function saveParams(data: Partial<Params>) {
  const p = await run(() => api<Params>('PUT', '/params', data));
  if (p) {
    app.params = p;
    toast('Réglages enregistrés');
  }
  return !!p;
}

/* ---------- Export CSV (colonnes lisibles, ouvrable dans Excel) ---------- */
type Col<T> = [string, (r: T) => string | number];
const n2 = (v: number) => v.toFixed(2).replace('.', ',');

function downloadCSV<T>(rows: T[], cols: Col<T>[], filename: string) {
  const cell = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.map(([h]) => cell(h)).join(';'), ...rows.map((r) => cols.map(([, f]) => cell(f(r))).join(';'))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportSales() {
  downloadCSV(app.sales, [
    ['Référence', (s) => s.ref], ['Article', (s) => s.name], ['Marque', (s) => s.brand], ['Catégorie', (s) => s.category],
    ['Date d’achat', (s) => s.purchase_date], ['Date de vente', (s) => s.sale_date], ['Plateforme', (s) => s.platform],
    ['Prix de vente (€)', (s) => n2(s.revenue)], ['Frais d’envoi (€)', (s) => n2(s.shipping)],
    ['Coût de revient (€)', (s) => n2(calcSale(s).cost)], ['Bénéfice (€)', (s) => n2(calcSale(s).profit)],
    ['ROI (%)', (s) => n2(calcSale(s).roi * 100)], ['Jours en stock', (s) => calcSale(s).delay],
  ], `ventes-${todayISO()}.csv`);
}

export function exportStock() {
  downloadCSV(app.stock, [
    ['Référence', (s) => s.ref], ['Article', (s) => s.name], ['Marque', (s) => s.brand], ['Catégorie', (s) => s.category],
    ['Statut', (s) => s.status], ['Date d’achat', (s) => s.purchase_date], ['Acheté sur', (s) => s.buy_platform],
    ['Coût de revient (€)', (s) => n2(costOf(s.gross, s.buy_fee, s.shipping, s.repair))], ['Prix visé (€)', (s) => n2(s.resale)],
    ['En ligne sur', (s) => s.published_on.join(', ')], ['Dernière publication', (s) => s.last_publication],
  ], `stock-${todayISO()}.csv`);
}

export function exportOpportunities() {
  downloadCSV(app.opportunities, [
    ['Article', (o) => o.name], ['Marque', (o) => o.brand], ['Catégorie', (o) => o.category], ['Plateforme', (o) => o.buy_platform],
    ['Prix d’achat visé (€)', (o) => n2(o.target_buy)], ['Prix de revente visé (€)', (o) => n2(o.resale)],
    ['Coût de revient (€)', (o) => n2(costOf(o.target_buy, o.buy_fee, o.shipping, o.repair))], ['Lien', (o) => o.buy_link],
  ], `opportunites-${todayISO()}.csv`);
}
