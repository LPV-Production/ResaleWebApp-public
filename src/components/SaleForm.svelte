<script lang="ts">
  import Modal from './Modal.svelte';
  import { app, closeModal, recordSale } from '../lib/store.svelte';
  import { calcStock, todayISO } from '../lib/calc';
  import { eur, pct } from '../lib/format';

  let { id }: { id: string } = $props();

  const item = app.stock.find((s) => s.id === id)!;
  const cost = calcStock(item).total;

  // La plateforme de revente prévue est maintenant bien présélectionnée
  let f = $state({
    sale_date: todayISO(),
    platform: item.published_on[0] ?? item.resale_platform ?? app.params.resale_platforms[0]?.name ?? '',
    revenue: item.resale as number | null,
    shipping: 0 as number | null,
  });

  const net = $derived((Number(f.revenue) || 0) - (Number(f.shipping) || 0));
  const profit = $derived(net - cost);
  const roi = $derived(cost ? profit / cost : 0);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    recordSale(id, { sale_date: f.sale_date || todayISO(), platform: f.platform, revenue: Number(f.revenue) || 0, shipping: Number(f.shipping) || 0 });
  }
</script>

<Modal title="Enregistrer la vente" subtitle="{item.name} · {item.ref}" onclose={closeModal}>
  <form id="sale-form" onsubmit={submit} class="form-section">
    <div class="form-grid">
      <label class="field"><span>Prix de vente encaissé *</span><div class="input-suffix"><input class="input num" type="number" step="0.01" min="0" inputmode="decimal" required bind:value={f.revenue} /><span>€</span></div></label>
      <label class="field"><span>Frais d’envoi payés</span><div class="input-suffix"><input class="input num" type="number" step="0.01" min="0" inputmode="decimal" bind:value={f.shipping} /><span>€</span></div><span class="hint">Emballage, étiquette… à ta charge</span></label>
      <label class="field"><span>Vendu sur</span>
        <select class="input" bind:value={f.platform}>{#each app.params.resale_platforms as pl}<option>{pl.name}</option>{/each}</select>
      </label>
      <label class="field"><span>Date de vente</span><input class="input" type="date" bind:value={f.sale_date} /></label>
    </div>
  </form>

  <dl class="recap num" aria-live="polite">
    <div><dt>Net perçu</dt><dd>{eur(net)}</dd></div>
    <div><dt>Coût de revient</dt><dd>− {eur(cost)}</dd></div>
    <div class="result"><dt>Bénéfice réel</dt><dd class:pos={profit > 0} class:neg={profit < 0}>{eur(profit)} <span class="muted small">· ROI {pct(roi)}</span></dd></div>
  </dl>

  {#snippet footer()}
    <button type="button" class="btn" onclick={closeModal}>Annuler</button>
    <button type="submit" form="sale-form" class="btn btn-primary" disabled={app.busy}>Confirmer la vente</button>
  {/snippet}
</Modal>

<style>
  .recap { margin: 0; padding: 14px 16px; border-radius: var(--radius); background: var(--surface-2); display: flex; flex-direction: column; gap: 6px; }
  .recap div { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
  .recap dt { color: var(--text-2); }
  .recap dd { margin: 0; }
  .result { border-top: 1px dashed var(--border-strong); padding-top: 10px; margin-top: 4px; font-weight: 700; font-size: 16px !important; }
  .result dt { color: var(--text) !important; }
</style>
