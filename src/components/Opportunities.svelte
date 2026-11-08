<script lang="ts">
  import Icon from './Icon.svelte';
  import { app, buyOpportunity, deleteOpportunity, openOppForm } from '../lib/store.svelte';
  import { calcOpportunity } from '../lib/calc';
  import { eur, pct } from '../lib/format';

  type Filter = 'Tout' | 'Acheter' | 'Négocier' | 'Passer';
  let filter = $state<Filter>('Tout');
  let sort = $state<'score' | 'profit' | 'recent'>('score');

  const all = $derived(app.opportunities.map((o) => ({ o, c: calcOpportunity(o, app.params) })));
  const counts = $derived({
    Tout: all.length,
    Acheter: all.filter((x) => x.c.action === 'Acheter').length,
    Négocier: all.filter((x) => x.c.action === 'Négocier').length,
    Passer: all.filter((x) => x.c.action === 'Passer').length,
  });
  const rows = $derived(
    all
      .filter((x) => filter === 'Tout' || x.c.action === filter)
      .sort((a, b) =>
        sort === 'score' ? b.c.score - a.c.score : sort === 'profit' ? b.c.profit - a.c.profit : b.o.created_at.localeCompare(a.o.created_at),
      ),
  );

  const actionClass = (a: string) => (a === 'Acheter' ? 'badge-pos' : a === 'Négocier' ? 'badge-warn' : 'badge-neg');
</script>

<header class="page-head">
  <div>
    <h1>Opportunités</h1>
    <p class="muted">Les annonces repérées, pas encore achetées. Seuil de rentabilité : {pct(app.params.go_margin)}.</p>
  </div>
  <div class="page-head-actions">
    <button class="btn btn-primary" onclick={() => openOppForm()}><Icon name="plus" size={16} /> Nouvelle opportunité</button>
  </div>
</header>

<div class="toolbar">
  <div class="segmented" role="tablist" aria-label="Filtrer par recommandation">
    {#each Object.keys(counts) as f}
      <button role="tab" aria-selected={filter === f} class:active={filter === f} onclick={() => (filter = f as Filter)}>
        {f} <span class="n num">{counts[f as Filter]}</span>
      </button>
    {/each}
  </div>
  <label class="sort">
    <span class="muted small">Trier par</span>
    <select class="input" bind:value={sort}>
      <option value="score">Score</option>
      <option value="profit">Bénéfice</option>
      <option value="recent">Plus récentes</option>
    </select>
  </label>
</div>

{#if rows.length}
  <ul class="grid">
    {#each rows as { o, c } (o.id)}
      <li class="card opp">
        <div class="top">
          <span class="score num" style="--p:{c.score}" aria-label="Score {c.score} sur 100"><span>{c.score}</span></span>
          <div class="title">
            <h2>{o.name}</h2>
            <p class="muted small">{[o.brand, o.category, o.buy_platform].filter(Boolean).join(' · ')}</p>
          </div>
          <span class="badge {actionClass(c.action)}">{c.action}</span>
        </div>

        <dl class="nums">
          <div><dt>Achat visé</dt><dd class="num">{eur(o.target_buy)}</dd></div>
          <div><dt>Revente visée</dt><dd class="num">{eur(o.resale)}</dd></div>
          <div><dt>Coût de revient</dt><dd class="num">{eur(c.total)}</dd></div>
          <div><dt>Bénéfice</dt><dd class="num" class:pos={c.profit > 0} class:neg={c.profit < 0}>{eur(c.profit)} <span class="muted">· {pct(c.roi)}</span></dd></div>
        </dl>

        {#if o.notes}<p class="notes small">{o.notes}</p>{/if}

        <div class="meta muted small">
          {#if o.repair}<span><Icon name="wrench" size={14} /> {eur(o.repair)} de réparation</span>{/if}
          {#if o.buy_link}<a href={o.buy_link} target="_blank" rel="noopener"><Icon name="external" size={14} /> Voir l’annonce</a>{/if}
        </div>

        <div class="actions">
          <button class="btn btn-primary btn-sm grow" onclick={() => buyOpportunity(o.id)}><Icon name="check" size={15} /> J’ai acheté</button>
          <button class="btn btn-sm" onclick={() => openOppForm(o.id)}>Modifier</button>
          <button class="btn btn-sm btn-icon btn-danger" aria-label="Supprimer {o.name}" onclick={() => deleteOpportunity(o.id)}><Icon name="trash" size={15} /></button>
        </div>
      </li>
    {/each}
  </ul>
{:else}
  <div class="card empty-state">
    <Icon name="radar" size={28} />
    <p><strong>{all.length ? 'Aucune opportunité dans ce filtre' : 'Aucune opportunité pour l’instant'}</strong></p>
    <p class="muted small">Repère une annonce intéressante et ajoute-la : l’appli calcule le coût de revient, le bénéfice et te dit s’il faut acheter.</p>
    {#if !all.length}<button class="btn btn-primary" onclick={() => openOppForm()}><Icon name="plus" size={16} /> Nouvelle opportunité</button>{/if}
  </div>
{/if}

<style>
  .toolbar { display: flex; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; }
  .sort { display: flex; align-items: center; gap: 8px; }
  .sort .input { width: auto; min-height: 38px; }

  .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
  .opp { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
  .top { display: flex; align-items: flex-start; gap: 12px; }
  .title { flex: 1; min-width: 0; }
  .title h2 { font-size: 16px; font-weight: 650; }

  .score {
    flex-shrink: 0; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center;
    font-size: 13px; font-weight: 700; background: conic-gradient(var(--accent) calc(var(--p) * 1%), var(--surface-2) 0);
  }
  .score span { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--surface); }

  .nums { margin: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 16px; padding: 12px 14px; border-radius: var(--radius-sm); background: var(--surface-2); }
  .nums div { display: flex; flex-direction: column; }
  .nums dt { font-size: 12px; color: var(--text-3); }
  .nums dd { margin: 0; font-weight: 650; font-size: 14px; }
  .notes { color: var(--text-2); }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 14px; }
  .meta span, .meta a { display: inline-flex; align-items: center; gap: 5px; }
  .actions { display: flex; gap: 8px; margin-top: auto; }
  .grow { flex: 1; }

  @media (max-width: 900px) {
    .toolbar { flex-direction: column; align-items: stretch; }
    .sort { justify-content: flex-end; }
    .grid { grid-template-columns: minmax(0, 1fr); gap: 10px; }
    .opp { padding: 14px; }
  }
</style>
