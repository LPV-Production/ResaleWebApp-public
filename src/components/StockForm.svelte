<script lang="ts">
  import Modal from './Modal.svelte';
  import { app, closeModal, saveStock, type StockForm } from '../lib/store.svelte';
  import { costOf, todayISO, type RepairStatus } from '../lib/calc';
  import { eur } from '../lib/format';

  let { id }: { id?: string } = $props();

  const existing = app.stock.find((s) => s.id === id);
  const p = app.params;
  const REPAIR: RepairStatus[] = ['Non nécessaire', 'À faire', 'En cours', 'Terminée'];

  let f = $state({
    name: existing?.name ?? '',
    brand: existing?.brand ?? '',
    category: existing?.category ?? '',
    buy_platform: existing?.buy_platform ?? p.buy_platforms[0]?.name ?? '',
    purchase_date: existing?.purchase_date ?? todayISO(),
    gross: existing?.gross ?? null,
    fee_pct: existing ? Math.round(existing.buy_fee * 1000) / 10 : 5,
    shipping: existing?.shipping ?? null,
    repair: existing?.repair ?? null,
    repair_status: existing?.repair_status ?? ('Non nécessaire' as RepairStatus),
    repair_notes: existing?.repair_notes ?? '',
    resale: existing?.resale ?? null,
    resale_platform: existing?.resale_platform ?? p.resale_platforms[0]?.name ?? '',
    photos: existing?.photos ?? '',
    description: existing?.description ?? '',
  });

  const data = $derived<StockForm>({
    name: f.name.trim(), brand: f.brand.trim(), category: f.category.trim(), buy_platform: f.buy_platform,
    purchase_date: f.purchase_date || todayISO(), gross: Number(f.gross) || 0, buy_fee: (Number(f.fee_pct) || 0) / 100,
    shipping: Number(f.shipping) || 0, repair: Number(f.repair) || 0, repair_status: f.repair_status,
    repair_notes: f.repair_notes.trim(), resale: Number(f.resale) || 0, resale_platform: f.resale_platform,
    photos: f.photos.trim(), description: f.description.trim(),
  });
  const total = $derived(costOf(data.gross, data.buy_fee, data.shipping, data.repair));
  const categories = $derived([...new Set([...app.opportunities, ...app.stock].map((x) => x.category).filter(Boolean))].sort());

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!data.name) return;
    saveStock(data, id);
  }
</script>

<Modal title={id ? 'Modifier l’article' : 'Ajouter un article au stock'} subtitle={existing ? existing.ref : 'La référence est créée automatiquement.'} onclose={closeModal} wide>
  <form id="stock-form" onsubmit={submit} class="form-section">
    <div class="form-grid">
      <label class="field full"><span>Nom de l’article *</span><input class="input" required bind:value={f.name} /></label>
      <label class="field"><span>Marque</span><input class="input" bind:value={f.brand} /></label>
      <label class="field"><span>Catégorie</span>
        <input class="input" list="stock-cats" bind:value={f.category} />
        <datalist id="stock-cats">{#each categories as cat}<option value={cat}></option>{/each}</datalist>
      </label>
      <label class="field"><span>Acheté sur</span>
        <select class="input" bind:value={f.buy_platform}>{#each p.buy_platforms as pl}<option>{pl.name}</option>{/each}</select>
      </label>
      <label class="field"><span>Date d’achat</span><input class="input" type="date" bind:value={f.purchase_date} /></label>
    </div>
  </form>

  <div class="form-section">
    <div class="head"><h3>Coût</h3><span class="muted small">Coût de revient : <strong class="num total">{eur(total)}</strong></span></div>
    <div class="form-grid cols-3">
      <label class="field"><span>Prix d’achat</span><div class="input-suffix"><input form="stock-form" class="input num" type="number" step="0.01" min="0" inputmode="decimal" bind:value={f.gross} /><span>€</span></div></label>
      <label class="field"><span>Frais d’achat</span><div class="input-suffix"><input form="stock-form" class="input num" type="number" step="0.1" min="0" inputmode="decimal" bind:value={f.fee_pct} /><span>%</span></div></label>
      <label class="field"><span>Frais de port</span><div class="input-suffix"><input form="stock-form" class="input num" type="number" step="0.01" min="0" inputmode="decimal" bind:value={f.shipping} /><span>€</span></div></label>
    </div>
  </div>

  <div class="form-section">
    <h3>Réparation</h3>
    <div class="form-grid cols-3">
      <label class="field"><span>Coût</span><div class="input-suffix"><input form="stock-form" class="input num" type="number" step="0.01" min="0" inputmode="decimal" bind:value={f.repair} /><span>€</span></div></label>
      <label class="field"><span>Statut</span>
        <select form="stock-form" class="input" bind:value={f.repair_status}>{#each REPAIR as r}<option>{r}</option>{/each}</select>
      </label>
      <label class="field full-mobile"><span>Ce qui a été fait / à faire</span><input form="stock-form" class="input" bind:value={f.repair_notes} /></label>
    </div>
  </div>

  <div class="form-section">
    <h3>Revente</h3>
    <div class="form-grid">
      <label class="field"><span>Prix visé</span><div class="input-suffix"><input form="stock-form" class="input num" type="number" step="0.01" min="0" inputmode="decimal" bind:value={f.resale} /><span>€</span></div></label>
      <label class="field"><span>Plateforme principale</span>
        <select form="stock-form" class="input" bind:value={f.resale_platform}>{#each p.resale_platforms as pl}<option>{pl.name}</option>{/each}</select>
      </label>
      <label class="field full"><span>Lien des photos</span><input form="stock-form" class="input" type="url" bind:value={f.photos} placeholder="https://drive.google.com/…" /><span class="hint">Dossier Google Drive (ou autre) où sont rangées les photos de l’article.</span></label>
      <label class="field full"><span>Description</span><textarea form="stock-form" class="input" rows="4" bind:value={f.description} placeholder="État, taille, accessoires inclus… (reprise dans le texte de l’annonce)"></textarea></label>
    </div>
  </div>

  {#snippet footer()}
    <button type="button" class="btn" onclick={closeModal}>Annuler</button>
    <button type="submit" form="stock-form" class="btn btn-primary" disabled={app.busy}>Enregistrer</button>
  {/snippet}
</Modal>

<style>
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .total { color: var(--text); font-size: 15px; }
  @media (max-width: 640px) { .full-mobile { grid-column: 1 / -1; } }
</style>
