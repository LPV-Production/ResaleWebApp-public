<script lang="ts">
  import Icon from './Icon.svelte';
  import { app, openItem, openStockForm } from '../lib/store.svelte';
  import { calcStock, stockAlert, type StockStatus } from '../lib/calc';
  import { eur, pct, dateFr } from '../lib/format';

  type Filter = StockStatus | 'Tout';
  const FILTERS: Filter[] = ['En stock', 'Vendu', 'Archivé', 'Tout'];

  let filter = $state<Filter>('En stock');
  let query = $state('');

  const counts = $derived(
    Object.fromEntries(FILTERS.map((f) => [f, f === 'Tout' ? app.stock.length : app.stock.filter((s) => s.status === f).length])),
  );

  const rows = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return app.stock
      .filter((s) => filter === 'Tout' || s.status === filter)
      .filter((s) => !q || [s.name, s.brand, s.category, s.ref].join(' ').toLowerCase().includes(q))
      .map((s) => ({ s, c: calcStock(s), a: stockAlert(s, app.params) }));
  });

  const alertBadge = (lvl: string) =>
    lvl === 'republish' ? 'badge-neg' : lvl === 'soon' ? 'badge-warn' : lvl === 'ok' ? 'badge-pos' : '';
  const repairBadge = (st: string) => (st === 'À faire' ? 'badge-warn' : st === 'En cours' ? 'badge-accent' : '');
  const short = (p: string) => app.params.resale_platforms.find((x) => x.name === p)?.prefix ?? p.slice(0, 3).toUpperCase();
</script>

<header class="page-head">
  <div>
    <h1>Stock</h1>
    <p class="muted">Les articles achetés, en cours de revente.</p>
  </div>
  <div class="page-head-actions">
    <button class="btn btn-primary" onclick={() => openStockForm()}><Icon name="plus" size={16} /> Ajouter un article</button>
  </div>
</header>

<div class="toolbar">
  <label class="search">
    <span class="sr-only">Rechercher</span>
    <Icon name="search" size={16} />
    <input class="input" type="search" placeholder="Rechercher un article, une marque, une référence…" bind:value={query} />
  </label>
  <div class="segmented" role="tablist" aria-label="Filtrer par statut">
    {#each FILTERS as f}
      <button role="tab" aria-selected={filter === f} class:active={filter === f} onclick={() => (filter = f)}>
        {f} <span class="n num">{counts[f]}</span>
      </button>
    {/each}
  </div>
</div>

{#if rows.length}
  <!-- Ordinateur : tableau -->
  <div class="card table-wrap">
    <table>
      <thead>
        <tr>
          <th>Article</th>
          <th>Catégorie</th>
          <th class="r">Coût de revient</th>
          <th class="r">Prix visé</th>
          <th class="r">Bénéfice pot.</th>
          <th>En ligne sur</th>
          <th>Relance</th>
          <th><span class="sr-only">Ouvrir</span></th>
        </tr>
      </thead>
      <tbody>
        {#each rows as { s, c, a }}
          <tr onclick={() => openItem(s.id)}>
            <td>
              <button class="cell-title" onclick={(e) => { e.stopPropagation(); openItem(s.id); }}>
                <span class="title">{s.name}</span>
                <span class="muted small">{s.ref}{s.brand ? ' · ' + s.brand : ''}</span>
              </button>
            </td>
            <td class="muted">{s.category || '—'}</td>
            <td class="r num">{eur(c.total)}</td>
            <td class="r num">{eur(s.resale)}</td>
            <td class="r num">
              <span class:pos={c.profit > 0} class:neg={c.profit < 0}>{eur(c.profit)}</span>
              <span class="muted small roi">{pct(c.roi)}</span>
            </td>
            <td>
              {#if s.published_on.length}
                <span class="chips">{#each s.published_on as p}<span class="chip" title={p}>{short(p)}</span>{/each}</span>
              {:else}
                <span class="muted small">Pas encore</span>
              {/if}
            </td>
            <td>
              {#if s.status === 'En stock'}
                <span class="badge {alertBadge(a.level)}"><span class="dot"></span>{a.level === 'ok' ? `${a.days} j` : a.label}</span>
              {:else}
                <span class="badge">{s.status}</span>
              {/if}
            </td>
            <td class="r"><Icon name="chevronRight" size={16} /></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Téléphone : cartes -->
  <ul class="cards">
    {#each rows as { s, c, a }}
      <li>
        <button class="card m-card" onclick={() => openItem(s.id)}>
          <div class="m-top">
            <div class="m-title">
              <span class="title">{s.name}</span>
              <span class="muted small">{s.ref} · acheté le {dateFr(s.purchase_date)}</span>
            </div>
            {#if s.status === 'En stock'}
              <span class="badge {alertBadge(a.level)}"><span class="dot"></span>{a.level === 'ok' ? `${a.days} j` : a.label}</span>
            {:else}
              <span class="badge">{s.status}</span>
            {/if}
          </div>
          <div class="m-nums">
            <div><span class="muted small">Coût</span><strong class="num">{eur(c.total)}</strong></div>
            <div><span class="muted small">Prix visé</span><strong class="num">{eur(s.resale)}</strong></div>
            <div><span class="muted small">Bénéfice</span><strong class="num" class:pos={c.profit > 0} class:neg={c.profit < 0}>{eur(c.profit)}</strong></div>
          </div>
          <div class="m-foot">
            {#if s.published_on.length}
              <span class="chips">{#each s.published_on as p}<span class="chip">{short(p)}</span>{/each}</span>
            {:else}
              <span class="muted small">Pas encore en ligne</span>
            {/if}
            {#if s.repair_status === 'À faire' || s.repair_status === 'En cours'}
              <span class="badge {repairBadge(s.repair_status)}"><Icon name="wrench" size={12} /> Réparation {s.repair_status.toLowerCase()}</span>
            {/if}
          </div>
        </button>
      </li>
    {/each}
  </ul>
{:else}
  <div class="card empty">
    <Icon name="package" size={28} />
    <p><strong>Aucun article ici</strong></p>
    <p class="muted small">{query ? 'Aucun résultat pour cette recherche.' : 'Achète une opportunité ou ajoute un article directement.'}</p>
  </div>
{/if}

<style>
  .toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
  .search { position: relative; flex: 1; min-width: 240px; display: flex; align-items: center; color: var(--text-3); }
  .search :global(svg) { position: absolute; left: 12px; pointer-events: none; }
  .search .input { padding-left: 38px; }


  .table-wrap { overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th {
    text-align: left; font-size: 12px; font-weight: 600; color: var(--text-3);
    padding: 12px 16px; background: var(--surface-2); border-bottom: 1px solid var(--border); white-space: nowrap;
  }
  td { padding: 12px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr { cursor: pointer; transition: background var(--dur-fast); }
  tbody tr:hover { background: var(--surface-hover); }
  tbody tr td:last-child { color: var(--text-3); }
  .r { text-align: right; }
  .cell-title { display: flex; flex-direction: column; border: 0; background: none; padding: 0; text-align: left; cursor: pointer; }
  .title { font-weight: 600; color: var(--text); }
  .roi { display: block; }
  .chips { display: inline-flex; gap: 4px; flex-wrap: wrap; }
  .chip {
    display: inline-grid; place-items: center; height: 22px; padding: 0 7px; border-radius: 6px;
    background: var(--accent-soft); color: var(--accent-text); font-size: 11px; font-weight: 700; letter-spacing: 0.02em;
  }

  .cards { display: none; list-style: none; margin: 0; padding: 0; flex-direction: column; gap: 10px; }
  .m-card { display: flex; flex-direction: column; gap: 12px; width: 100%; padding: 14px; text-align: left; cursor: pointer; }
  .m-card:active { background: var(--surface-hover); }
  .m-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .m-title { display: flex; flex-direction: column; min-width: 0; }
  .m-nums { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--surface-2); }
  .m-nums div { display: flex; flex-direction: column; }
  .m-nums strong { font-size: 14px; }
  .m-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }

  .empty { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 48px 20px; text-align: center; color: var(--text-3); }
  .empty p strong { color: var(--text); }

  @media (max-width: 1100px) {
    th:nth-child(2), td:nth-child(2) { display: none; }
  }
  @media (max-width: 900px) {
    .search { min-width: 100%; }
    .table-wrap { display: none; }
    .cards { display: flex; }
  }
</style>
