// Formats d'affichage (euros, pourcentages, dates) en français.
import { parseDay } from './calc';

const eurFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const eurRound = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export const eur = (v: number) => eurFmt.format(v || 0);
export const eur0 = (v: number) => eurRound.format(v || 0);
export const signedEur = (v: number) => (v > 0 ? '+' : '') + eurFmt.format(v || 0);
export const pct = (v: number) =>
  ((v || 0) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %';

export function dateFr(v: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  if (!v) return '—';
  return parseDay(v).toLocaleDateString('fr-FR', opts);
}

export function todayLong() {
  const s = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
