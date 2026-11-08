<script lang="ts">
  import Icon from './Icon.svelte';
  import { app, go, markRepublished, openItem } from '../lib/store.svelte';
  import { calcStock, daysSince, isRelaunch, stockAlert } from '../lib/calc';
  import { eur, plural } from '../lib/format';

  const DORMANT_DAYS = 30;

  const active = $derived(app.stock.filter((s) => s.status === 'En stock'));
  const alerts = $derived(
    active.map((s) => ({ s, a: stockAlert(s, app.params) })).filter((x) => isRelaunch(x.a.level)).sort((a, b) => b.a.days - a.a.days),
  );
  const notPublished = $derived(active.filter((s) => !s.published_on.length));
  const repairs = $derived(active.filter((s) => s.repair_status === 'À faire' || s.repair_status === 'En cours'));
  const dormant = $derived(
    active.filter((s) => daysSince(s.purchase_date) >= DORMANT_DAYS).sort((a, b) => daysSince(b.purchase_date) - daysSince(a.purchase_date)),
  );
  const dormantValue = $derived(dormant.reduce((a, s) => a + calcStock(s).total, 0));
  const nothing = $derived(!alerts.length && !notPublished.length && !repairs.length && !dormant.length);
</script>

<header class="page-head">
  <div>
    <h1>Relances</h1>
    <p class="muted">Ce qui demande ton attention pour vendre plus vite.</p>
  </div>
</header>

{#if nothing}
  <div class="card empty-state">
    <Icon name="check" size={28} />
    <p><strong>Rien à signaler</strong></p>
    <p class="muted small">Toutes tes annonces sont récentes et aucun article ne traîne.</p>
  </div>
{:else}
  <div class="sections">
    {#if alerts.length}
      <section class="card">
        <header class="sec-head">
          <span class="ic warn"><Icon name="bell" /></span>
          <div>
            <h2>À republier <span class="muted num">· {alerts.length}</span></h2>
            <p class="muted small">Annonces sans republication depuis {app.params.reminder_days} jours ou plus. Remonte l’annonce ou baisse un peu le prix.</p>
          </div>
        </header>
        <ul class="list">
          {#each alerts as { s, a } (s.id)}
            <li>
              <button class="item" onclick={() => openItem(s.id)}>
                <span class="title">{s.name}</span>
                <span class="muted small">{s.ref} · {s.published_on.join(', ') || 'non publié'} · {eur(s.resale)}</span>
              </button>
              <span class="badge {a.level === 'republish' ? 'badge-neg' : 'badge-warn'} num"><span class="dot"></span>{a.days} j</span>
              <button class="btn btn-sm" aria-label="Marquer {s.name} comme republié" onclick={() => markRepublished(s.id)}><Icon name="refresh" size={15} /><span class="hide-sm">Republié</span></button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if notPublished.length}
      <section class="card">
        <header class="sec-head">
          <span class="ic accent"><Icon name="fileText" /></span>
          <div>
            <h2>Pas encore en ligne <span class="muted num">· {notPublished.length}</span></h2>
            <p class="muted small">Articles en stock sans aucune annonce publiée.</p>
          </div>
        </header>
        <ul class="list">
          {#each notPublished as s (s.id)}
            <li>
              <button class="item" onclick={() => openItem(s.id)}>
                <span class="title">{s.name}</span>
                <span class="muted small">{s.ref} · acheté il y a {plural(daysSince(s.purchase_date), 'jour', 'jours')}</span>
              </button>
              <button class="btn btn-sm" onclick={() => openItem(s.id)}>Publier <Icon name="chevronRight" size={14} /></button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if repairs.length}
      <section class="card">
        <header class="sec-head">
          <span class="ic"><Icon name="wrench" /></span>
          <div>
            <h2>Réparations en attente <span class="muted num">· {repairs.length}</span></h2>
            <p class="muted small">Tant qu’elles ne sont pas faites, ces articles ne peuvent pas être vendus au prix visé.</p>
          </div>
        </header>
        <ul class="list">
          {#each repairs as s (s.id)}
            <li>
              <button class="item" onclick={() => openItem(s.id)}>
                <span class="title">{s.name}</span>
                <span class="muted small">{s.repair_notes || 'Pas de détail'} · {eur(s.repair)}</span>
              </button>
              <span class="badge {s.repair_status === 'À faire' ? 'badge-warn' : 'badge-accent'}">{s.repair_status}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if dormant.length}
      <section class="card">
        <header class="sec-head">
          <span class="ic neg"><Icon name="hourglass" /></span>
          <div>
            <h2>Stock dormant <span class="muted num">· {dormant.length}</span></h2>
            <p class="muted small">En stock depuis plus de {DORMANT_DAYS} jours · <span class="num">{eur(dormantValue)}</span> immobilisés. Pense à baisser le prix ou changer de plateforme.</p>
          </div>
        </header>
        <ul class="list">
          {#each dormant as s (s.id)}
            <li>
              <button class="item" onclick={() => openItem(s.id)}>
                <span class="title">{s.name}</span>
                <span class="muted small">{s.ref} · coût {eur(calcStock(s).total)} · visé {eur(s.resale)}</span>
              </button>
              <span class="badge badge-neg num">{daysSince(s.purchase_date)} j</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </div>

  <p class="muted small foot">Les délais se règlent dans <button class="link" onclick={() => go('settings')}>Réglages</button>.</p>
{/if}

<style>
  .sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
  .sec-head { display: flex; gap: 12px; padding: 18px 20px 12px; }
  .sec-head h2 { font-size: 15px; font-weight: 650; }
  .ic { flex-shrink: 0; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: var(--surface-2); color: var(--text-2); }
  .ic.warn { background: var(--warn-soft); color: var(--warn); }
  .ic.neg { background: var(--neg-soft); color: var(--neg); }
  .ic.accent { background: var(--accent-soft); color: var(--accent-text); }

  .list { list-style: none; margin: 0; padding: 0 20px 8px; }
  .list li { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid var(--border); }
  .item { flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 0; border: 0; background: none; text-align: left; cursor: pointer; }
  .item:hover .title { color: var(--accent-text); }
  .title { font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item .muted { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .foot { margin-top: 16px; }
  .link { border: 0; background: none; padding: 0; color: var(--accent-text); font-weight: 600; cursor: pointer; }

  @media (max-width: 1100px) { .sections { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 900px) {
    .sections { gap: 10px; }
    .sec-head { padding: 14px 14px 10px; }
    .list { padding: 0 14px 6px; }
    .hide-sm { display: none; }
  }
</style>
