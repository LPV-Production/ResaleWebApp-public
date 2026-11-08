<script lang="ts">
  import Modal from './Modal.svelte';
  import { app, closeModal, saveOpportunity } from '../lib/store.svelte';
  import { calcOpportunity, type Opportunity } from '../lib/calc';
  import { eur, pct } from '../lib/format';

  let { id }: { id?: string } = $props();

  const existing = app.opportunities.find((o) => o.id === id);
  const p = app.params;

  // Les frais sont saisis en % (5) et enregistrés en fraction (0.05)
  let f = $state({
    name: existing?.name ?? '',
    brand: existing?.brand ?? '',
    category: existing?.category ?? '',
    buy_link: existing?.buy_link ?? '',
    buy_platform: existing?.buy_platform ?? p.buy_platforms[0]?.name ?? '',
    target_buy: existing?.target_buy ?? null,
    fee_pct: existing ? Math.round(existing.buy_fee * 1000) / 10 : 5,
    shipping: existing?.shipping ?? null,
    repair: existing?.repair ?? null,
    resale: existing?.resale ?? null,
    notes: existing?.notes ?? '',
  });

  const data = $derived<Omit<Opportunity, 'id' | 'created_at'>>({
    name: f.name.trim(), brand: f.brand.trim(), category: f.category.trim(), buy_link: f.buy_link.trim(),
    buy_platform: f.buy_platform, target_buy: Number(f.target_buy) || 0, buy_fee: (Number(f.fee_pct) || 0) / 100,
    shipping: Number(f.shipping) || 0, repair: Number(f.repair) || 0, resale: Number(f.resale) || 0, notes: f.notes.trim(),
  });
  const c = $derived(calcOpportunity({ ...data, id: '', created_at: '' }, p));
  const categories = $derived([...new Set([...app.opportunities, ...app.stock].map((x) => x.category).filter(Boolean))].sort());

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!data.name) return;
    saveOpportunity(data, id);
  }
  const actionClass = (a: string) => (a === 'Acheter' ? 'badge-pos' : a === 'Négocier' ? 'badge-warn' : 'badge-neg');
</script>

<Modal title={id ? 'Modifier l’opportunité' : 'Nouvelle opportunité'} subtitle="Une annonce repérée : l’appli calcule si c’est une bonne affaire." onclose={closeModal} wide>
  <form id="opp-form" onsubmit={submit} class="form-section">
    <div class="form-grid">
      <label class="field full"><span>Nom de l’article *</span><input class="input" required bind:value={f.name} placeholder="ex. Veste Barbour Bedale" /></label>
      <label class="field"><span>Marque</span><input class="input" bind:value={f.brand} /></label>
      <label class="field"><span>Catégorie</span>
        <input class="input" list="opp-cats" bind:value={f.category} />
        <datalist id="opp-cats">{#each categories as cat}<option value={cat}></option>{/each}</datalist>
      </label>
      <label class="field"><span>Acheté sur</span>
        <select class="input" bind:value={f.buy_platform}>{#each p.buy_platforms as pl}<option>{pl.name}</option>{/each}</select>
      </label>
      <label class="field"><span>Lien de l’annonce</span><input class="input" type="url" bind:value={f.buy_link} placeholder="https://…" /></label>
    </div>
  </form>

  <div class="form-section">
    <h3>Chiffres</h3>
    <div class="form-grid cols-3">
      <label class="field"><span>Prix d’achat visé</span><div class="input-suffix"><input form="opp-form" class="input num" type="number" step="0.01" min="0" inputmode="decimal" bind:value={f.target_buy} /><span>€</span></div></label>
      <label class="field"><span>Frais d’achat</span><div class="input-suffix"><input form="opp-form" class="input num" type="number" step="0.1" min="0" inputmode="decimal" bind:value={f.fee_pct} /><span>%</span></div></label>
      <label class="field"><span>Frais de port</span><div class="input-suffix"><input form="opp-form" class="input num" type="number" step="0.01" min="0" inputmode="decimal" bind:value={f.shipping} /><span>€</span></div></label>
      <label class="field"><span>Réparation estimée</span><div class="input-suffix"><input form="opp-form" class="input num" type="number" step="0.01" min="0" inputmode="decimal" bind:value={f.repair} /><span>€</span></div></label>
      <label class="field"><span>Prix de revente visé</span><div class="input-suffix"><input form="opp-form" class="input num" type="number" step="0.01" min="0" inputmode="decimal" bind:value={f.resale} /><span>€</span></div></label>
    </div>

    <div class="verdict" aria-live="polite">
      <div class="v-score num" style="--p:{c.score}"><span>{c.score}</span></div>
      <div class="v-nums">
        <div><span class="muted small">Coût de revient</span><strong class="num">{eur(c.total)}</strong></div>
        <div><span class="muted small">Bénéfice</span><strong class="num" class:pos={c.profit > 0} class:neg={c.profit < 0}>{eur(c.profit)}</strong></div>
        <div><span class="muted small">ROI</span><strong class="num">{pct(c.roi)}</strong></div>
      </div>
      <span class="badge {actionClass(c.action)}">{c.action}</span>
    </div>
  </div>

  <div class="form-section">
    <label class="field"><span>Notes</span><textarea form="opp-form" class="input" rows="3" bind:value={f.notes} placeholder="État, taille, points à vérifier…"></textarea></label>
  </div>

  {#snippet footer()}
    <button type="button" class="btn" onclick={closeModal}>Annuler</button>
    <button type="submit" form="opp-form" class="btn btn-primary" disabled={app.busy}>Enregistrer</button>
  {/snippet}
</Modal>

<style>
  .verdict { display: flex; align-items: center; gap: 16px; padding: 14px 16px; border-radius: var(--radius); background: var(--surface-2); }
  .v-score {
    flex-shrink: 0; width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center;
    background: conic-gradient(var(--accent) calc(var(--p) * 1%), var(--border) 0); font-weight: 700;
  }
  .v-score span { display: grid; place-items: center; width: 39px; height: 39px; border-radius: 50%; background: var(--surface-2); }
  .v-nums { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .v-nums div { display: flex; flex-direction: column; }
  @media (max-width: 640px) {
    .verdict { flex-wrap: wrap; gap: 12px; }
    .v-nums { order: 3; flex-basis: 100%; }
    .verdict .badge { margin-left: auto; }
  }
</style>
