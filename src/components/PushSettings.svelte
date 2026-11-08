<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import { app, toast } from '../lib/store.svelte';
  import { disablePush, enablePush, getPushState, sendTestPush, type PushState } from '../lib/push';

  let state = $state<PushState | 'loading'>('loading');
  let busy = $state(false);

  onMount(async () => {
    state = await getPushState();
  });

  async function act(fn: () => Promise<unknown>) {
    busy = true;
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action impossible', true);
    } finally {
      state = await getPushState();
      busy = false;
    }
  }
</script>

<section class="card card-pad">
  <div class="head">
    <h2 class="card-title">Notifications de relance</h2>
    {#if state === 'on'}<span class="badge badge-pos"><span class="dot"></span>Activées</span>{/if}
  </div>
  <p class="muted small intro">
    Chaque matin à 9 h, une notification sur ce téléphone si des annonces sont à relancer (après {app.params.reminder_days} jours sans republication).
  </p>

  {#if state === 'loading'}
    <p class="muted small">…</p>
  {:else if state === 'needs-install'}
    <div class="steps">
      <p><strong>Sur iPhone, installe d’abord l’appli :</strong></p>
      <ol>
        <li>Ouvre ce site dans <strong>Safari</strong></li>
        <li>Touche le bouton <strong>Partager</strong> (carré avec une flèche)</li>
        <li>Choisis <strong>Sur l’écran d’accueil</strong></li>
        <li>Ouvre l’appli depuis sa nouvelle icône et reviens ici</li>
      </ol>
    </div>
  {:else if state === 'unsupported'}
    <p class="small">Ce navigateur ne gère pas les notifications. Utilise Chrome (Android, ordinateur) ou l’appli installée depuis Safari (iPhone, iOS 16.4 ou plus).</p>
  {:else if state === 'denied'}
    <p class="small">Les notifications sont bloquées pour ce site. Réactive-les dans les réglages du téléphone (Notifications → Resale), puis reviens ici.</p>
  {:else if state === 'off'}
    <button class="btn btn-primary" disabled={busy} onclick={() => act(async () => { if ((await enablePush()) === 'on') toast('Notifications activées sur cet appareil'); })}>
      <Icon name="bell" size={16} /> Activer sur cet appareil
    </button>
  {:else}
    <div class="row">
      <button class="btn" disabled={busy} onclick={() => act(async () => { await sendTestPush(); toast('Notification de test envoyée'); })}>
        Envoyer un test
      </button>
      <button class="btn btn-ghost btn-danger" disabled={busy} onclick={() => act(async () => { await disablePush(); toast('Notifications désactivées sur cet appareil'); })}>
        Désactiver
      </button>
    </div>
  {/if}
</section>

<style>
  .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .intro { margin: 4px 0 16px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; }
  .steps { padding: 12px 14px; border-radius: var(--radius-sm); background: var(--surface-2); font-size: 14px; }
  .steps ol { margin: 6px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 2px; }
  @media (max-width: 900px) { .card-pad { padding: 16px; } .row .btn { flex: 1; } }
</style>
