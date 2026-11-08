<script lang="ts">
  import { onMount } from 'svelte';
  import Shell from './Shell.svelte';
  import Login from './Login.svelte';
  import Icon from './Icon.svelte';
  import { app, loadAll } from '../lib/store.svelte';
  import { registerServiceWorker } from '../lib/push';

  onMount(() => {
    loadAll();
    registerServiceWorker();
  });
</script>

{#if app.phase === 'ready'}
  <Shell />
{:else if app.phase === 'login'}
  <Login />
{:else if app.phase === 'error'}
  <div class="center">
    <div class="card box">
      <Icon name="refresh" size={28} />
      <p><strong>Impossible de charger tes données</strong></p>
      <p class="muted small">{app.loadError}</p>
      <button class="btn btn-primary" onclick={() => { app.phase = 'loading'; loadAll(); }}>Réessayer</button>
    </div>
  </div>
{:else}
  <div class="center" aria-busy="true">
    <span class="spinner" role="status" aria-label="Chargement"></span>
  </div>
{/if}

<style>
  .center { min-height: 100dvh; display: grid; place-items: center; padding: 16px; }
  .box { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 40px 28px; text-align: center; max-width: 380px; color: var(--text-3); }
  .box strong { color: var(--text); }
  .box .btn { margin-top: 12px; }
  .spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--border); border-top-color: var(--accent); animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
