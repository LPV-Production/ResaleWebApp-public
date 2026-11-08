<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import { app, closeItem, togglePublish, markRepublished, archiveItem, restoreItem, deleteItem, toast, openSaleForm, openStockForm } from '../lib/store.svelte';
  import { calcStock, costOf, daysSince, stockAlert, type StockItem } from '../lib/calc';
  import { eur, pct, dateFr } from '../lib/format';

  let { id }: { id: string } = $props();

  const item = $derived(app.stock.find((s) => s.id === id));
  const c = $derived(item ? calcStock(item) : null);
  const alert = $derived(item ? stockAlert(item, app.params) : null);

  let adOpen = $state(false);
  let closeBtn: HTMLButtonElement | undefined = $state();

  const LISTING_URLS: Record<string, string> = {
    Vinted: 'https://www.vinted.fr/items/new',
    Leboncoin: 'https://www.leboncoin.fr/deposer-une-annonce',
    'Facebook Marketplace': 'https://www.facebook.com/marketplace/create/item',
  };

  function adText(d: StockItem) {
    const lines = [[d.brand, d.name].filter(Boolean).join(' ') || 'Article à vendre'];
    if (d.category) lines.push('Catégorie : ' + d.category);
    if (d.description) lines.push('', d.description);
    if (d.repair_notes && d.repair_status === 'Terminée') lines.push('', 'Entretien effectué : ' + d.repair_notes);
    if (d.resale) lines.push('', `Prix : ${d.resale} €`);
    lines.push('', 'Remise en main propre ou envoi selon la plateforme.', 'N’hésitez pas à me contacter pour toute question.');
    return lines.join('\n');
  }
  let text = $state('');
  $effect(() => { if (item) text = adText(item); });

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast('Texte copié');
    } catch {
      toast('Copie impossible : sélectionne le texte et copie-le', true);
    }
  }

  onMount(() => {
    closeBtn?.focus();
    // Échap ferme la fiche, sauf si un formulaire est ouvert par-dessus
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !app.modal && closeItem();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  });

  const repairBadge = (st: string) =>
    st === 'Terminée' ? 'badge-pos' : st === 'À faire' ? 'badge-warn' : st === 'En cours' ? 'badge-accent' : '';
</script>

<button class="backdrop" aria-label="Fermer la fiche" tabindex="-1" onclick={closeItem}></button>

{#if item && c && alert}
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <header class="sheet-head">
      <div class="head-badges">
        <span class="badge badge-accent num">{item.ref}</span>
        <span class="badge">{item.status}</span>
      </div>
      <button class="btn btn-ghost btn-icon" bind:this={closeBtn} onclick={closeItem} aria-label="Fermer">
        <Icon name="x" />
      </button>
    </header>

    <div class="sheet-body">
      <div class="intro">
        <h2 id="sheet-title">{item.name}</h2>
        <p class="muted small">
          {[item.brand, item.category, `acheté sur ${item.buy_platform || '—'} le ${dateFr(item.purchase_date, { day: 'numeric', month: 'long' })} (${daysSince(item.purchase_date)} j)`].filter(Boolean).join(' · ')}
        </p>
      </div>

      <!-- Rentabilité -->
      <section class="profit">
        <div>
          <span class="muted small">Prix visé</span>
          <strong class="big num">{eur(item.resale)}</strong>
        </div>
        <div>
          <span class="muted small">Bénéfice potentiel</span>
          <strong class="big num" class:pos={c.profit > 0} class:neg={c.profit < 0}>{eur(c.profit)}</strong>
        </div>
        <div>
          <span class="muted small">ROI</span>
          <strong class="big num">{pct(c.roi)}</strong>
        </div>
      </section>

      <section class="block">
        <h3>Coût de revient</h3>
        <dl class="breakdown num">
          <div><dt>Prix d’achat</dt><dd>{eur(item.gross)}</dd></div>
          <div><dt>Frais d’achat ({pct(item.buy_fee)})</dt><dd>{eur(item.gross * item.buy_fee)}</dd></div>
          <div><dt>Frais de port</dt><dd>{eur(item.shipping)}</dd></div>
          <div><dt>Réparation</dt><dd>{eur(item.repair)}</dd></div>
          <div class="total"><dt>Total</dt><dd>{eur(costOf(item.gross, item.buy_fee, item.shipping, item.repair))}</dd></div>
        </dl>
      </section>

      {#if item.status === 'En stock'}
        <section class="block">
          <div class="block-head">
            <h3>Publication</h3>
            <span class="badge {alert.level === 'republish' ? 'badge-neg' : alert.level === 'soon' ? 'badge-warn' : alert.level === 'ok' ? 'badge-pos' : ''}">
              <span class="dot"></span>{#if alert.level === 'offline'}Pas encore publié{:else}{alert.level === 'ok' ? 'Publié' : alert.label} · {alert.days === 0 ? 'aujourd’hui' : `il y a ${alert.days} j`}{/if}
            </span>
          </div>
          <div class="toggles">
            {#each app.params.resale_platforms as p}
              {@const on = item.published_on.includes(p.name)}
              <button class="toggle" class:on aria-pressed={on} onclick={() => togglePublish(item.id, p.name)}>
                <span class="tick">{#if on}<Icon name="check" size={14} />{/if}</span>
                {p.name}
              </button>
            {/each}
          </div>
          <button class="btn btn-sm" onclick={() => markRepublished(item.id)}>
            <Icon name="refresh" size={15} /> Republié aujourd’hui
          </button>
        </section>

        <section class="block">
          <button class="block-head toggle-head" aria-expanded={adOpen} onclick={() => (adOpen = !adOpen)}>
            <h3><Icon name="fileText" size={16} /> Texte de l’annonce</h3>
            <span class="chev" class:open={adOpen}><Icon name="chevronRight" size={16} /></span>
          </button>
          {#if adOpen}
            <textarea class="input" rows="9" bind:value={text} aria-label="Texte de l’annonce"></textarea>
            <div class="ad-actions">
              <button class="btn btn-primary btn-sm" onclick={copy}><Icon name="copy" size={15} /> Copier</button>
              {#each Object.entries(LISTING_URLS) as [name, url]}
                <a class="btn btn-sm" href={url} target="_blank" rel="noopener">{name} <Icon name="external" size={13} /></a>
              {/each}
            </div>
          {/if}
        </section>
      {/if}

      <section class="block">
        <h3>Détails</h3>
        <dl class="details">
          <div>
            <dt>Réparation</dt>
            <dd>
              <span class="badge {repairBadge(item.repair_status)}">{item.repair_status}</span>
              {#if item.repair_notes}<span class="muted small">{item.repair_notes}</span>{/if}
            </dd>
          </div>
          <div>
            <dt>Photos</dt>
            <dd>
              {#if item.photos}
                <a href={item.photos} target="_blank" rel="noopener"><Icon name="image" size={15} /> Dossier Google Drive <Icon name="external" size={13} /></a>
              {:else}<span class="muted">Aucun lien</span>{/if}
            </dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{#if item.description}{item.description}{:else}<span class="muted">Pas encore de description</span>{/if}</dd>
          </div>
        </dl>
      </section>
    </div>

    <footer class="sheet-foot">
      {#if item.status === 'En stock'}
        <button class="btn btn-primary grow" onclick={() => openSaleForm(item.id)}><Icon name="banknote" size={16} /> Enregistrer la vente</button>
        <button class="btn" onclick={() => openStockForm(item.id)}>Modifier</button>
        <button class="btn btn-icon" aria-label="Archiver" title="Archiver" onclick={() => archiveItem(item.id)}><Icon name="archive" /></button>
      {:else if item.status === 'Archivé'}
        <button class="btn btn-primary grow" onclick={() => restoreItem(item.id)}>Remettre en stock</button>
        <button class="btn" onclick={() => openStockForm(item.id)}>Modifier</button>
      {:else}
        <button class="btn grow" onclick={() => openStockForm(item.id)}>Modifier</button>
      {/if}
      <button class="btn btn-icon btn-danger" aria-label="Supprimer" title="Supprimer" onclick={() => deleteItem(item.id)}><Icon name="trash" /></button>
    </footer>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; z-index: 40; border: 0; background: var(--overlay); animation: fade var(--dur) ease-out; }
  .sheet {
    position: fixed; z-index: 41; top: 12px; right: 12px; bottom: 12px; width: min(500px, calc(100vw - 24px));
    display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; box-shadow: var(--shadow-lg); overflow: hidden;
    animation: slide-in 260ms var(--ease-out);
  }
  .sheet-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 0 20px; }
  .head-badges { display: flex; gap: 6px; }
  .sheet-body { flex: 1; overflow-y: auto; padding: 8px 20px 20px; display: flex; flex-direction: column; gap: 18px; overscroll-behavior: contain; }
  .sheet-body > * { flex-shrink: 0; }
  .intro h2 { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 4px; }

  .profit { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; border-radius: var(--radius); overflow: hidden; background: var(--border); border: 1px solid var(--border); }
  .profit div { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; background: var(--surface-2); }
  .big { font-size: 18px; font-weight: 700; }

  .block { display: flex; flex-direction: column; gap: 10px; padding-top: 16px; border-top: 1px solid var(--border); }
  .block h3 { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 650; }
  .block-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .block > .btn { align-self: flex-start; }
  .toggle-head { border: 0; background: none; padding: 0; cursor: pointer; width: 100%; min-height: 32px; }
  .chev { color: var(--text-3); transition: transform var(--dur) var(--ease-out); display: flex; }
  .chev.open { transform: rotate(90deg); }

  .breakdown, .details { margin: 0; display: flex; flex-direction: column; }
  .breakdown div { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
  .breakdown dt { color: var(--text-2); }
  .breakdown dd { margin: 0; }
  .breakdown .total { border-top: 1px dashed var(--border-strong); margin-top: 4px; padding-top: 10px; font-weight: 700; }
  .breakdown .total dt { color: var(--text); }

  .details div { display: grid; grid-template-columns: 110px 1fr; gap: 12px; padding: 8px 0; font-size: 14px; }
  .details dt { color: var(--text-3); }
  .details dd { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .details a { display: inline-flex; align-items: center; gap: 6px; }

  .toggles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .toggle {
    display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 12px;
    border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface);
    font-size: 14px; font-weight: 550; cursor: pointer; text-align: left;
    transition: border-color var(--dur-fast), background var(--dur-fast);
  }
  .toggle:hover { border-color: var(--border-strong); }
  .tick { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid var(--border-strong); flex-shrink: 0; }
  .toggle.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-text); }
  .toggle.on .tick { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }

  .ad-actions { display: flex; flex-wrap: wrap; gap: 8px; }

  .sheet-foot { display: flex; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--border); background: var(--surface); padding-bottom: calc(14px + env(safe-area-inset-bottom)); }
  .grow { flex: 1; }

  @media (max-width: 640px) {
    .sheet { top: auto; left: 0; right: 0; bottom: 0; width: 100%; max-height: 92dvh; border-radius: 20px 20px 0 0; animation-name: slide-up; }
    .sheet-body { padding: 8px 16px 16px; }
    .sheet-foot { padding-left: 16px; padding-right: 16px; }
    .big { font-size: 16px; }
    .profit div { padding: 10px; }
    .details div { grid-template-columns: 90px 1fr; }
  }

  @keyframes fade { from { opacity: 0; } }
  @keyframes slide-in { from { transform: translateX(24px); opacity: 0; } }
  @keyframes slide-up { from { transform: translateY(40px); opacity: 0; } }
</style>
