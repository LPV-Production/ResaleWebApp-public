// ============================================================
// Calculs métier : coût de revient, bénéfice, ROI, score, relances.
// Mêmes formules que la version 1, avec ces corrections :
// - les dates suivent l'heure française (plus de "veille" après minuit),
// - les cases de publication suivent la liste des plateformes des Réglages.
// ============================================================

export type Platform = { name: string; prefix: string };

export type Params = {
  go_margin: number; // 0.15 = 15 %
  republish_days: number;
  reminder_days: number;
  buy_platforms: Platform[];
  resale_platforms: Platform[];
  ref_counter: number; // dernier numéro de référence utilisé
};

export type Opportunity = {
  id: string;
  created_at: string;
  name: string;
  brand: string;
  category: string;
  buy_link: string;
  buy_platform: string;
  target_buy: number;
  buy_fee: number; // fraction (0.05 = 5 %)
  shipping: number;
  repair: number;
  resale: number;
  notes: string;
};

export type StockStatus = 'En stock' | 'Vendu' | 'Archivé';
export type RepairStatus = 'Non nécessaire' | 'À faire' | 'En cours' | 'Terminée';

export type StockItem = {
  id: string;
  ref: string;
  purchase_date: string;
  name: string;
  brand: string;
  category: string;
  buy_platform: string;
  gross: number;
  buy_fee: number;
  shipping: number;
  repair: number;
  repair_status: RepairStatus;
  repair_notes: string;
  resale: number;
  resale_platform: string;
  photos: string;
  description: string;
  status: StockStatus;
  published_on: string[]; // noms des plateformes où l'annonce est en ligne
  last_publication: string;
};

export type Sale = {
  id: string;
  stock_id: string | null;
  ref: string;
  name: string;
  brand: string;
  category: string;
  purchase_date: string;
  sale_date: string;
  platform: string;
  revenue: number;
  shipping: number;
  gross: number;
  buy_fee: number;
  buy_shipping: number;
  repair: number;
};

const DAY = 86_400_000;

/** Date du jour au format AAAA-MM-JJ, à l'heure locale (pas en UTC). */
export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Lit "AAAA-MM-JJ" comme une date locale (minuit en France, pas en UTC). */
export function parseDay(v: string): Date {
  const [y, m, d] = v.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysSince(v: string | null | undefined): number {
  if (!v) return 0;
  const start = parseDay(v).getTime();
  const today = parseDay(todayISO()).getTime();
  return Math.max(0, Math.round((today - start) / DAY));
}

export function costOf(price: number, fee: number, shipping: number, repair: number) {
  return price * (1 + fee) + shipping + repair;
}

export function calcOpportunity(o: Opportunity, p: Params) {
  const total = costOf(o.target_buy, o.buy_fee, o.shipping, o.repair);
  const profit = o.resale - total;
  const roi = total ? profit / total : 0;
  const threshold = p.go_margin;

  let score = 0;
  // Score sur 100 : rentabilité (60 pts), prix de revente (25 pts), réparation (15 pts)
  score += Math.max(0, Math.min(60, roi * 100));
  score += o.resale > 0 ? Math.min(25, (o.resale / 100) * 25) : 0;
  score += o.repair === 0 ? 15 : Math.max(0, 15 - o.repair * 0.15);
  score = Math.round(score);

  let action: 'Acheter' | 'Négocier' | 'Passer' =
    roi >= threshold ? 'Acheter' : roi >= threshold * 0.6 ? 'Négocier' : 'Passer';
  if (score >= 75 && roi >= threshold) action = 'Acheter';
  return { total, profit, roi, score, action, go: roi >= threshold };
}

export function calcStock(s: StockItem) {
  const total = costOf(s.gross, s.buy_fee, s.shipping, s.repair);
  const profit = s.resale - total;
  const roi = total ? profit / total : 0;
  return { total, profit, roi };
}

export function calcSale(s: Sale) {
  const net = s.revenue - s.shipping;
  const cost = costOf(s.gross, s.buy_fee, s.buy_shipping, s.repair);
  const profit = net - cost;
  const roi = cost ? profit / cost : 0;
  const delay =
    s.purchase_date && s.sale_date
      ? Math.max(0, Math.round((parseDay(s.sale_date).getTime() - parseDay(s.purchase_date).getTime()) / DAY))
      : 0;
  return { net, cost, profit, roi, delay };
}

export type AlertLevel = 'offline' | 'ok' | 'soon' | 'republish';

/** Vrai si l'annonce est en ligne mais vieillit : il faut la relancer. */
export const isRelaunch = (l: AlertLevel) => l === 'soon' || l === 'republish';

export function stockAlert(s: StockItem, p: Params): { level: AlertLevel; label: string; days: number } {
  const days = daysSince(s.last_publication);
  // Jamais publié : pas de relance possible, l'article apparaît dans « Pas encore en ligne »
  if (!s.published_on.length) return { level: 'offline', label: 'Pas en ligne', days };
  if (days >= p.republish_days) return { level: 'republish', label: 'À republier', days };
  if (days >= p.reminder_days) return { level: 'soon', label: 'Relance proche', days };
  return { level: 'ok', label: 'Récent', days };
}
