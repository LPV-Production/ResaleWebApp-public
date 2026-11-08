<script lang="ts">
  import Icon from './Icon.svelte';
  import { app, deleteSale, exportSales } from '../lib/store.svelte';
  import { calcSale, parseDay } from '../lib/calc';
  import { eur, pct, dateFr, plural } from '../lib/format';

  type Period = 'Ce mois' | '3 mois' | 'Cette année' | 'Tout';
  const PERIODS: Period[] = ['Ce mois', '3 mois', 'Cette année', 'Tout'];
  let period = $state<Period>('Tout');

  function since(p: Period): Date | null {
    const now = new Date();
    if (p === 'Ce mois') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (p === '3 mois') return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    if (p === 'Cette année') return new Date(now.getFullYear(), 0, 1);
    return null;
  }

  const rows = $derived.by(() => {
    const from = since(period);
    return app.sales
      .filter((s) => !from || parseDay(s.sale_date) >= from)
      .sort((a, b) => b.sale_date.localeCompare(a.sale_date))
      .map((s) => ({ s, c: calcSale(s) }));
  });
  const totals = $derived.by(() => {
    const revenue = rows.reduce((a, x) => a + x.s.revenue, 0);
    const profit = rows.reduce((a, x) => a + x.c.profit, 0);
    const cost = rows.reduce((a, x) => a + x.c.cost, 0);
    const delays = rows.map((x) => x.c.delay).filter(Boolean);
    return {
      revenue, profit, roi: cost ? profit / cost : 0,
      delay: delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 0,
    };
  });
  // Bénéfice par plateforme de vente
  const byPlatform = $derived.by(() => {
    const m = new Map<string, { n: number; profit: number }>();
    for (const { s, c } of rows) {
      const e = m.get(s.platform || 'Autre') ?? { n: 0, profit: 0 };
      e.n++; e.profit += c.profit;
      m.set(s.platform || 'Autre', e);
    }
    return [...m.entries()].sort((a, b) => b[1].profit - a[1].profit);
  });
</script>

<header class="page-head">
  <div>
    <h1>Ventes</h1>
    <p class="muted">L’historique de tes ventes et le bénéfice réel de chacune.</p>
  </div>
  <div class="page-head-actions">
    <button class="btn" onclick={exportSales} disabled={!app.sales.length}><Icon name="download" size={16} /> Exporter (Excel)</button>
  </div>
</header>

<div class="segmented period" role="tablist" aria-label="Période">
  {#each PERIODS as p}
    <button role="tab" aria-selected={period === p} class:active={period === p} onclick={() => (period = p)}>{p}</button>
  {/each}
</div>

<section class="card summary" aria-label="Résumé de la période">
  <div class="stat"><span class="muted small">Bénéfice net</span><strong class="num" class:pos={totals.profit > 0} class:neg={totals.profit < 0}>{eur(totals.profit)}</strong></div>
  <div class="stat"><span class="muted small">Chiffre d’affaires</span><strong class="num">{eur(totals.revenue)}</strong></div>
  <div class="stat"><span class="muted small">ROI global</span><strong class="num">{pct(totals.roi)}</strong></div>
  <div class="stat"><span class="muted small">Délai moyen</span><strong class="num">{totals.delay} j</strong></div>
</section>

{#if byPlatform.length > 1}
  <div class="platforms">
    {#each byPlatform as [name, v]}
      <span class="badge">{name} · {plural(v.n, 'vente', 'ventes')} · <span class="num" class:pos={v.profit > 0} class:neg={v.profit < 0}>{eur(v.profit)}</span></span>
    {/each}
  </div>
{/if}

{#if rows.length}
  <div class="card table-wrap">
    <table>
      <thead>
        <tr>
          <th>Article</th><th>Vendu le</th><th>Sur</th>
          <th class="r">Prix de vente</th><th class="r">Coût</th><th class="r">Bénéfice</th><th class="r">Gardé</th>
          <th><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {#each rows as { s, c } (s.id)}
          <tr>
            <td><span class="title">{s.name}</span><span class="muted small">{[s.ref, s.category].filter(Boolean).join(' · ')}</span></td>
            <td class="num">{dateFr(s.sale_date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
            <td class="muted">{s.platform}</td>
            <td class="r num">{eur(s.revenue)}</td>
            <td class="r num muted">{eur(c.cost)}</td>
            <td class="r num"><span class:pos={c.profit > 0} class:neg={c.profit < 0}>{eur(c.profit)}</span><span class="muted small block">{pct(c.roi)}</span></td>
            <td class="r num muted">{c.delay} j</td>
            <td class="r"><button class="btn btn-ghost btn-sm btn-icon btn-danger" aria-label="Supprimer la vente {s.name}" onclick={() => deleteSale(s.id)}><Icon name="trash" size={15} /></button></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <ul class="cards">
    {#each rows as { s, c } (s.id)}
      <li class="card m-card">
        <div class="m-top">
          <div class="m-title">
            <span class="title">{s.name}</span>
            <span class="muted small">{dateFr(s.sale_date)} · {s.platform} · gardé {c.delay} j</span>
          </div>
          <strong class="num profit" class:pos={c.profit > 0} class:neg={c.profit < 0}>{c.profit > 0 ? '+' : ''}{eur(c.profit)}</strong>
        </div>
        <div class="m-foot">
          <span class="muted small num">Vendu {eur(s.revenue)} · coût {eur(c.cost)} · ROI {pct(c.roi)}</span>
          <button class="btn btn-ghost btn-sm btn-icon btn-danger" aria-label="Supprimer la vente {s.name}" onclick={() => deleteSale(s.id)}><Icon name="trash" size={15} /></button>
        </div>
      </li>
    {/each}
  </ul>
{:else}
  <div class="card empty-state">
    <Icon name="receipt" size={28} />
    <p><strong>Aucune vente sur cette période</strong></p>
    <p class="muted small">Quand tu vends un article, ouvre sa fiche dans le stock et clique sur « Enregistrer la vente ».</p>
  </div>
{/if}

<style>
  .period { margin-bottom: 16px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); margin-bottom: 12px; }
  .stat { display: flex; flex-direction: column; gap: 2px; padding: 16px 20px; }
  .stat + .stat { border-left: 1px solid var(--border); }
  .stat strong { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
  .platforms { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }

  .table-wrap { overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; font-size: 12px; font-weight: 600; color: var(--text-3); padding: 12px 16px; background: var(--surface-2); border-bottom: 1px solid var(--border); white-space: nowrap; }
  td { padding: 12px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:hover { background: var(--surface-hover); }
  td:first-child { display: flex; flex-direction: column; }
  .title { font-weight: 600; }
  .r { text-align: right; }
  .block { display: block; }

  .cards { display: none; list-style: none; margin: 0; padding: 0; flex-direction: column; gap: 10px; }
  .m-card { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
  .m-top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .m-title { display: flex; flex-direction: column; min-width: 0; }
  .profit { font-size: 16px; white-space: nowrap; }
  .m-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; }

  @media (max-width: 1100px) {
    th:nth-child(5), td:nth-child(5), th:nth-child(7), td:nth-child(7) { display: none; }
  }
  @media (max-width: 900px) {
    .summary { grid-template-columns: repeat(2, 1fr); }
    .stat { padding: 12px 14px; }
    .stat strong { font-size: 17px; }
    .stat:nth-child(3) { border-left: 0; }
    .stat:nth-child(n + 3) { border-top: 1px solid var(--border); }
    .table-wrap { display: none; }
    .cards { display: flex; }
  }
</style>
