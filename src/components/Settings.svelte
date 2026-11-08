<script lang="ts">
  import Icon from './Icon.svelte';
  import PushSettings from './PushSettings.svelte';
  import { app, saveParams, exportOpportunities, exportSales, exportStock, toast, changePassword, signOut } from '../lib/store.svelte';
  import { pct } from '../lib/format';
  import type { Platform } from '../lib/calc';

  // Copies modifiables : rien n'est enregistré tant qu'on ne clique pas sur "Enregistrer"
  let th = $state({
    go_margin: Math.round(app.params.go_margin * 1000) / 10,
    reminder_days: app.params.reminder_days,
    republish_days: app.params.republish_days,
  });
  let buy = $state<Platform[]>(app.params.buy_platforms.map((p) => ({ ...p })));
  let resale = $state<Platform[]>(app.params.resale_platforms.map((p) => ({ ...p })));

  const thDirty = $derived(
    th.go_margin / 100 !== app.params.go_margin || th.reminder_days !== app.params.reminder_days || th.republish_days !== app.params.republish_days,
  );
  const platDirty = $derived(JSON.stringify([buy, resale]) !== JSON.stringify([app.params.buy_platforms, app.params.resale_platforms]));

  function saveThresholds(e: SubmitEvent) {
    e.preventDefault();
    if (th.reminder_days >= th.republish_days) {
      return toast('La relance doit arriver avant le délai « à republier »', true);
    }
    saveParams({ go_margin: (Number(th.go_margin) || 0) / 100, reminder_days: Number(th.reminder_days), republish_days: Number(th.republish_days) });
  }

  async function savePlatforms() {
    const clean = (l: Platform[]) => l.map((p) => ({ name: p.name.trim(), prefix: p.prefix.trim().toUpperCase() })).filter((p) => p.name);
    if (await saveParams({ buy_platforms: clean(buy), resale_platforms: clean(resale) })) {
      buy = app.params.buy_platforms.map((p) => ({ ...p }));
      resale = app.params.resale_platforms.map((p) => ({ ...p }));
    }
  }

  // Changement de mot de passe
  let pw = $state({ current: '', next: '', confirm: '' });
  async function submitPassword(e: SubmitEvent) {
    e.preventDefault();
    if (pw.next !== pw.confirm) return toast('Les deux nouveaux mots de passe ne correspondent pas', true);
    if (await changePassword(pw.current, pw.next)) pw = { current: '', next: '', confirm: '' };
  }
</script>

<header class="page-head">
  <div>
    <h1>Réglages</h1>
    <p class="muted">Propres à ton compte ({app.user?.label}).</p>
  </div>
</header>

<div class="layout">
  <PushSettings />

  <section class="card card-pad">
    <h2 class="card-title">Seuils de décision</h2>
    <p class="muted small intro">Ils servent au verdict des opportunités et aux alertes de relance.</p>
    <form class="form-section" onsubmit={saveThresholds}>
      <label class="field">
        <span>Rentabilité minimum pour « Acheter »</span>
        <div class="input-suffix"><input class="input num" type="number" step="0.5" min="0" inputmode="decimal" bind:value={th.go_margin} /><span>%</span></div>
        <span class="hint">ROI à atteindre. Entre {pct(th.go_margin * 0.006)} et ce seuil, l’appli conseille de négocier.</span>
      </label>
      <div class="form-grid">
        <label class="field">
          <span>Relance proche après</span>
          <div class="input-suffix"><input class="input num" type="number" min="1" inputmode="numeric" bind:value={th.reminder_days} /><span>j</span></div>
        </label>
        <label class="field">
          <span>« À republier » après</span>
          <div class="input-suffix"><input class="input num" type="number" min="1" inputmode="numeric" bind:value={th.republish_days} /><span>j</span></div>
        </label>
      </div>
      <div><button class="btn btn-primary" type="submit" disabled={!thDirty || app.busy}>Enregistrer</button></div>
    </form>
  </section>

  <section class="card card-pad platforms">
    <h2 class="card-title">Plateformes</h2>
    <p class="muted small intro">Le préfixe sert à créer la référence des articles (ex. <strong>VIN</strong>-2026-012). Les plateformes de revente apparaissent comme cases à cocher dans chaque fiche.</p>

    {#each [{ label: 'Achat', list: buy, kind: 'buy' }, { label: 'Revente', list: resale, kind: 'resale' }] as group}
      <div class="plat-group">
        <h3>{group.label}</h3>
        <ul>
          {#each group.list as p, i}
            <li>
              <input class="input" aria-label="Nom de la plateforme" placeholder="Nom" bind:value={p.name} />
              <input class="input prefix" aria-label="Préfixe" placeholder="ABC" maxlength="4" bind:value={p.prefix} />
              <button class="btn btn-ghost btn-icon btn-danger" aria-label="Retirer {p.name || 'cette plateforme'}" onclick={() => group.list.splice(i, 1)}>
                <Icon name="x" size={16} />
              </button>
            </li>
          {/each}
        </ul>
        <button class="btn btn-sm btn-ghost add" onclick={() => group.list.push({ name: '', prefix: '' })}><Icon name="plus" size={15} /> Ajouter</button>
      </div>
    {/each}
    <div><button class="btn btn-primary" onclick={savePlatforms} disabled={!platDirty || app.busy}>Enregistrer les plateformes</button></div>
  </section>

  <section class="card card-pad">
    <h2 class="card-title">Sauvegarde</h2>
    <p class="muted small intro">Télécharge tes données en fichier CSV, à ouvrir dans Excel ou Google Sheets.</p>
    <div class="exports">
      <button class="btn" onclick={exportOpportunities}><Icon name="radar" size={16} /> Opportunités</button>
      <button class="btn" onclick={exportStock}><Icon name="package" size={16} /> Stock</button>
      <button class="btn" onclick={exportSales}><Icon name="receipt" size={16} /> Ventes</button>
    </div>
  </section>

  <section class="card card-pad">
    <h2 class="card-title">Compte</h2>
    <p class="muted small intro">Connecté en tant que <strong>{app.user?.label}</strong>. Tes données ne sont visibles que par toi.</p>
    <form class="form-section" onsubmit={submitPassword}>
      <input type="text" name="username" autocomplete="username" value={app.user?.id} hidden />
      <label class="field"><span>Mot de passe actuel</span><input class="input" type="password" autocomplete="current-password" required bind:value={pw.current} /></label>
      <div class="form-grid">
        <label class="field"><span>Nouveau mot de passe</span><input class="input" type="password" autocomplete="new-password" minlength="10" required bind:value={pw.next} /></label>
        <label class="field"><span>Confirmer</span><input class="input" type="password" autocomplete="new-password" minlength="10" required bind:value={pw.confirm} /></label>
      </div>
      <span class="hint muted small">10 caractères minimum. Les autres appareils connectés seront déconnectés.</span>
      <div class="exports">
        <button class="btn btn-primary" type="submit" disabled={app.busy}>Changer le mot de passe</button>
        <button class="btn btn-danger" type="button" onclick={signOut}><Icon name="logout" size={16} /> Se déconnecter</button>
      </div>
    </form>
  </section>
</div>

<style>
  /* La dernière ligne absorbe la hauteur de la carte Plateformes : pas de trou entre les cartes de gauche */
  .layout { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: auto auto auto 1fr; gap: 16px; align-items: start; }
  .platforms { grid-column: 2; grid-row: 1 / span 4; display: flex; flex-direction: column; gap: 16px; }
  .platforms .intro { margin-bottom: 0; }
  .intro { margin: 4px 0 16px; }
  .plat-group h3 { font-size: 13px; font-weight: 650; color: var(--text-2); margin-bottom: 8px; }
  .plat-group ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .plat-group li { display: flex; gap: 6px; }
  .prefix { width: 76px; flex-shrink: 0; text-transform: uppercase; text-align: center; font-weight: 600; }
  .add { margin-top: 6px; color: var(--accent-text); }
  .exports { display: flex; flex-wrap: wrap; gap: 8px; }
  @media (max-width: 1000px) {
    .layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: none; gap: 10px; }
    .platforms { grid-column: auto; grid-row: auto; }
  }
  @media (max-width: 900px) { .card-pad { padding: 16px; } .exports .btn { flex: 1; } }
</style>
