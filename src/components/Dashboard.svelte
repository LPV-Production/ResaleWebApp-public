<script lang="ts">
  import Icon from './Icon.svelte';
  import ProfitChart from './ProfitChart.svelte';
  import { app, go, openItem, markRepublished, openOppForm } from '../lib/store.svelte';
  import { calcOpportunity, calcSale, calcStock, isRelaunch, parseDay, stockAlert } from '../lib/calc';
  import { eur, eur0, pct, signedEur, todayLong, plural } from '../lib/format';

  const active = $derived(app.stock.filter((s) => s.status === 'En stock'));
  const sales = $derived(app.sales.map((s) => ({ s, c: calcSale(s) })));

  const profitTotal = $derived(sales.reduce((a, x) => a + x.c.profit, 0));
  const revenue = $derived(sales.reduce((a, x) => a + x.s.revenue, 0));
  const invested = $derived(active.reduce((a, s) => a + calcStock(s).total, 0));
  const stockValue = $derived(active.reduce((a, s) => a + s.resale, 0));
  const potential = $derived(stockValue - invested);
  const avgRoi = $derived.by(() => {
    const r = sales.filter((x) => x.c.cost > 0).map((x) => x.c.roi);
    return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0;
  });
  const avgDelay = $derived.by(() => {
    const d = sales.filter((x) => x.c.delay).map((x) => x.c.delay);
    return d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : 0;
  });

  // Bénéfice des 6 derniers mois
  const months = $derived.by(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, k) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - k), 1);
      const items = sales.filter((x) => {
        const sd = parseDay(x.s.sale_date);
        return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth();
      });
      return {
        label: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
        full: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        profit: items.reduce((a, x) => a + x.c.profit, 0),
        count: items.length,
      };
    });
  });
  const thisMonth = $derived(months[5]);
  const lastMonth = $derived(months[4]);

  const alerts = $derived(
    active
      .map((s) => ({ s, a: stockAlert(s, app.params) }))
      .filter((x) => isRelaunch(x.a.level))
      .sort((a, b) => b.a.days - a.a.days),
  );

  const topOpps = $derived(
    app.opportunities
      .map((o) => ({ o, c: calcOpportunity(o, app.params) }))
      .sort((a, b) => b.c.score - a.c.score)
      .slice(0, 4),
  );

  const categories = $derived.by(() => {
    const m = new Map<string, { count: number; value: number }>();
    for (const s of active) {
      const k = s.category || 'Sans catégorie';
      const e = m.get(k) ?? { count: 0, value: 0 };
      e.count++;
      e.value += calcStock(s).total;
      m.set(k, e);
    }
    const rows = [...m.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 6);
    const max = Math.max(1, ...rows.map(([, v]) => v.value));
    return rows.map(([name, v]) => ({ name, ...v, ratio: v.value / max }));
  });

  const actionClass = (a: string) => (a === 'Acheter' ? 'badge-pos' : a === 'Négocier' ? 'badge-warn' : 'badge-neg');
</script>

<header class="page-head">
  <div>
    <p class="muted small">{todayLong()}</p>
    <h1>Bonjour {app.user?.label}</h1>
  </div>
  <div class="page-head-actions">
    <button class="btn btn-primary" onclick={() => openOppForm()}>
      <Icon name="plus" size={16} /> Nouvelle opportunité
    </button>
  </div>
</header>

<!-- Chiffres clés -->
<section class="kpis" aria-label="Chiffres clés">
  <article class="card kpi kpi-hero">
    <div class="kpi-label"><Icon name="trendingUp" size={16} /> Bénéfice net total</div>
    <div class="kpi-value num" class:neg={profitTotal < 0}>{eur(profitTotal)}</div>
    <div class="kpi-foot small">
      <span class="badge {thisMonth.profit >= lastMonth.profit ? 'badge-pos' : 'badge-neg'} num">{signedEur(thisMonth.profit)}</span>
      <span class="muted">ce mois-ci</span>
    </div>
  </article>
  <article class="card kpi">
    <div class="kpi-label"><Icon name="banknote" size={16} /> Chiffre d’affaires</div>
    <div class="kpi-value num">{eur0(revenue)}</div>
    <div class="kpi-foot small muted">{plural(app.sales.length, 'vente', 'ventes')}</div>
  </article>
  <article class="card kpi">
    <div class="kpi-label"><Icon name="wallet" size={16} /> Capital immobilisé</div>
    <div class="kpi-value num">{eur0(invested)}</div>
    <div class="kpi-foot small muted">{plural(active.length, 'article', 'articles')} en stock</div>
  </article>
  <article class="card kpi">
    <div class="kpi-label"><Icon name="tag" size={16} /> Valeur de revente</div>
    <div class="kpi-value num">{eur0(stockValue)}</div>
    <div class="kpi-foot small"><span class="pos num">{signedEur(potential)}</span> <span class="muted">potentiel</span></div>
  </article>
</section>

<section class="card stats" aria-label="Indicateurs">
  <div class="stat"><span class="muted small">ROI moyen réel</span><strong class="num">{pct(avgRoi)}</strong></div>
  <div class="stat"><span class="muted small">Délai moyen de vente</span><strong class="num">{avgDelay} jours</strong></div>
  <div class="stat"><span class="muted small">Opportunités en attente</span><strong class="num">{app.opportunities.length}</strong></div>
  <div class="stat"><span class="muted small">Seuil de rentabilité</span><strong class="num">{pct(app.params.go_margin)}</strong></div>
</section>

<div class="grid-main">
  <section class="card card-pad chart-card">
    <div class="card-head">
      <div>
        <h2 class="card-title">Bénéfice net par mois</h2>
        <p class="muted small">6 derniers mois · <span class="num">{eur(months.reduce((a, m) => a + m.profit, 0))}</span></p>
      </div>
    </div>
    <ProfitChart {months} />
  </section>

  <section class="card card-pad">
    <div class="card-head">
      <h2 class="card-title">À relancer</h2>
      <button class="btn btn-ghost btn-sm" onclick={() => go('reminders')}>Tout voir <Icon name="chevronRight" size={14} /></button>
    </div>
    {#if alerts.length}
      <ul class="rows">
        {#each alerts.slice(0, 4) as { s, a }}
          <li class="row">
            <button class="row-main" onclick={() => openItem(s.id)}>
              <span class="row-title">{s.name}</span>
              <span class="muted small">{s.ref} · {a.days} j sans republication</span>
            </button>
            <span class="badge {a.level === 'republish' ? 'badge-neg' : 'badge-warn'}"><span class="dot"></span>{a.label}</span>
            <button class="btn btn-sm btn-icon" aria-label="Marquer {s.name} comme republié" onclick={() => markRepublished(s.id)}>
              <Icon name="refresh" size={15} />
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty muted"><Icon name="check" /> Tout est à jour.</p>
    {/if}
  </section>
</div>

<div class="grid-2">
  <section class="card card-pad">
    <div class="card-head">
      <h2 class="card-title">Meilleures opportunités</h2>
      <button class="btn btn-ghost btn-sm" onclick={() => go('opportunities')}>Tout voir <Icon name="chevronRight" size={14} /></button>
    </div>
    <ul class="rows">
      {#each topOpps as { o, c }}
        <li class="row">
          <span class="score num" style="--p:{c.score}" aria-label="Score {c.score} sur 100"><span>{c.score}</span></span>
          <div class="row-main static">
            <span class="row-title">{o.name}</span>
            <span class="muted small num">{eur(c.profit)} estimés · ROI {pct(c.roi)}</span>
          </div>
          <span class="badge {actionClass(c.action)}">{c.action}</span>
        </li>
      {/each}
    </ul>
  </section>

  <section class="card card-pad">
    <div class="card-head">
      <h2 class="card-title">Stock par catégorie</h2>
      <span class="muted small">capital investi</span>
    </div>
    <ul class="cats">
      {#each categories as cat}
        <li>
          <div class="cat-line">
            <span>{cat.name} <span class="muted">· {cat.count}</span></span>
            <span class="num">{eur0(cat.value)}</span>
          </div>
          <div class="bar"><div style="width:{cat.ratio * 100}%"></div></div>
        </li>
      {/each}
    </ul>
  </section>
</div>

<style>

  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
  .kpi { padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; }
  .kpi-label { display: flex; align-items: center; gap: 8px; color: var(--text-2); font-size: 13px; font-weight: 550; }
  .kpi-value { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
  .kpi-foot { display: flex; align-items: center; gap: 8px; }
  .kpi-hero { background: linear-gradient(140deg, var(--accent-soft), var(--surface) 70%); }
  .kpi-hero .kpi-label { color: var(--accent-text); }

  .stats { display: grid; grid-template-columns: repeat(4, 1fr); margin-bottom: 16px; }
  .stat { display: flex; flex-direction: column; gap: 2px; padding: 14px 20px; }
  .stat + .stat { border-left: 1px solid var(--border); }
  .stat strong { font-size: 17px; font-weight: 650; }

  .grid-main { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 16px; margin-bottom: 16px; }
  .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }

  .rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .row { display: flex; align-items: center; gap: 12px; padding: 10px 0; }
  .row + .row { border-top: 1px solid var(--border); }
  .row-main {
    flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; padding: 0;
    border: 0; background: none; text-align: left; cursor: pointer;
  }
  .row-main.static { cursor: default; }
  .row-main:not(.static):hover .row-title { color: var(--accent-text); }
  .row-title { font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { display: flex; align-items: center; gap: 8px; padding: 24px 0; }

  /* Anneau de score : la part colorée = le score sur 100 */
  .score {
    --size: 40px; flex-shrink: 0; width: var(--size); height: var(--size); border-radius: 50%;
    display: grid; place-items: center; font-size: 13px; font-weight: 700;
    background: conic-gradient(var(--accent) calc(var(--p) * 1%), var(--surface-2) 0);
  }
  .score span { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: var(--surface); }

  .cats { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
  .cat-line { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; font-weight: 550; margin-bottom: 6px; }
  .bar { height: 8px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
  .bar div { height: 100%; border-radius: 999px; background: var(--accent); }

  @media (max-width: 1100px) {
    .kpis { grid-template-columns: repeat(2, 1fr); }
    .grid-main, .grid-2 { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 900px) {
    .kpis { gap: 10px; margin-bottom: 10px; }
    .kpi { padding: 14px; gap: 6px; }
    .kpi-value { font-size: 20px; }
    .kpi-hero, .kpi:last-child { grid-column: 1 / -1; }
    .kpi-hero .kpi-value { font-size: 28px; }
    .stats { grid-template-columns: repeat(2, 1fr); margin-bottom: 10px; }
    .stat { padding: 12px 14px; }
    .stat:nth-child(3) { border-left: 0; }
    .stat:nth-child(n + 3) { border-top: 1px solid var(--border); }
    .grid-main, .grid-2 { gap: 10px; margin-bottom: 10px; }
    .card-pad { padding: 16px; }
  }
</style>
