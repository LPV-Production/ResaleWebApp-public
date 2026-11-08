<script lang="ts">
  import Icon from './Icon.svelte';
  import Dashboard from './Dashboard.svelte';
  import Stock from './Stock.svelte';
  import ArticleSheet from './ArticleSheet.svelte';
  import Opportunities from './Opportunities.svelte';
  import Sales from './Sales.svelte';
  import Reminders from './Reminders.svelte';
  import Settings from './Settings.svelte';
  import OppForm from './OppForm.svelte';
  import StockForm from './StockForm.svelte';
  import SaleForm from './SaleForm.svelte';
  import { app, go, signOut, type View } from '../lib/store.svelte';
  import { isRelaunch, stockAlert } from '../lib/calc';
  import { setBadge } from '../lib/push';

  const NAV: { view: View; label: string; icon: string }[] = [
    { view: 'dashboard', label: 'Tableau de bord', icon: 'dashboard' },
    { view: 'opportunities', label: 'Opportunités', icon: 'radar' },
    { view: 'stock', label: 'Stock', icon: 'package' },
    { view: 'sales', label: 'Ventes', icon: 'receipt' },
    { view: 'reminders', label: 'Relances', icon: 'bell' },
  ];
  const NAV_SECONDARY: { view: View; label: string; icon: string }[] = [
    { view: 'settings', label: 'Réglages', icon: 'sliders' },
  ];
  // Sur téléphone : 4 onglets + "Plus" (5 maximum en bas de l'écran).
  const MOBILE_TABS = NAV.slice(0, 4);
  const MORE_VIEWS: View[] = ['reminders', 'settings'];

  let moreOpen = $state(false);
  let theme = $state(typeof document !== 'undefined' ? document.documentElement.dataset.theme ?? 'light' : 'light');

  const reminderCount = $derived(
    app.stock.filter((s) => s.status === 'En stock' && isRelaunch(stockAlert(s, app.params).level)).length,
  );

  // Pastille sur l'icône de l'appli installée
  $effect(() => setBadge(reminderCount));

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('rm_theme', theme); } catch {}
  }

  function navTo(v: View) {
    moreOpen = false;
    go(v);
  }
</script>

<div class="shell">
  <aside class="sidebar" aria-label="Navigation principale">
    <div class="brand">
      <span class="logo" aria-hidden="true"><Icon name="tag" size={16} /></span>
      <span>Resale Manager</span>
    </div>

    <nav class="nav">
      {#each NAV as item}
        <button class="nav-item" class:active={app.view === item.view} aria-current={app.view === item.view ? 'page' : undefined} onclick={() => navTo(item.view)}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
          {#if item.view === 'reminders' && reminderCount}
            <span class="count num" aria-label="{reminderCount} à relancer">{reminderCount}</span>
          {/if}
        </button>
      {/each}
      <div class="nav-sep"></div>
      {#each NAV_SECONDARY as item}
        <button class="nav-item" class:active={app.view === item.view} aria-current={app.view === item.view ? 'page' : undefined} onclick={() => navTo(item.view)}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      {/each}
    </nav>

    <div class="user">
      <span class="avatar" aria-hidden="true">{app.user?.label[0]}</span>
      <div class="user-name">
        <strong>{app.user?.label}</strong>
        <span class="muted small">Espace personnel</span>
      </div>
      <button class="btn btn-ghost btn-sm btn-icon" onclick={toggleTheme} aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}>
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
      </button>
      <button class="btn btn-ghost btn-sm btn-icon" aria-label="Se déconnecter" onclick={signOut}>
        <Icon name="logout" size={16} />
      </button>
    </div>
  </aside>

  <header class="topbar">
    <div class="brand">
      <span class="logo" aria-hidden="true"><Icon name="tag" size={16} /></span>
      <span>Resale Manager</span>
    </div>
    <button class="btn btn-ghost btn-icon" onclick={toggleTheme} aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  </header>

  <main class="main">

    {#if app.view === 'dashboard'}
      <Dashboard />
    {:else if app.view === 'opportunities'}
      <Opportunities />
    {:else if app.view === 'stock'}
      <Stock />
    {:else if app.view === 'sales'}
      <Sales />
    {:else if app.view === 'reminders'}
      <Reminders />
    {:else}
      <Settings />
    {/if}
  </main>

  <nav class="bottom-nav" aria-label="Navigation">
    {#each MOBILE_TABS as item}
      <button class="tab" class:active={app.view === item.view} aria-current={app.view === item.view ? 'page' : undefined} onclick={() => navTo(item.view)}>
        <Icon name={item.icon} size={22} />
        <span>{item.view === 'dashboard' ? 'Accueil' : item.label}</span>
      </button>
    {/each}
    <button class="tab" class:active={MORE_VIEWS.includes(app.view)} aria-expanded={moreOpen} onclick={() => (moreOpen = !moreOpen)}>
      <span class="tab-icon">
        <Icon name="menu" size={22} />
        {#if reminderCount}<span class="tab-dot" aria-hidden="true"></span>{/if}
      </span>
      <span>Plus</span>
    </button>
  </nav>

  {#if moreOpen}
    <button class="more-backdrop" aria-label="Fermer le menu" onclick={() => (moreOpen = false)}></button>
    <div class="more-sheet" role="menu">
      {#each [NAV[4], ...NAV_SECONDARY] as item}
        <button class="nav-item" role="menuitem" onclick={() => navTo(item.view)}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
          {#if item.view === 'reminders' && reminderCount}<span class="count num">{reminderCount}</span>{/if}
        </button>
      {/each}
      <div class="nav-sep"></div>
      <button class="nav-item" role="menuitem" onclick={signOut}><Icon name="logout" /><span>Se déconnecter ({app.user?.label})</span></button>
    </div>
  {/if}
</div>

{#if app.selectedId}
  <ArticleSheet id={app.selectedId} />
{/if}

{#if app.modal?.kind === 'opp'}
  <OppForm id={app.modal.id} />
{:else if app.modal?.kind === 'stock'}
  <StockForm id={app.modal.id} />
{:else if app.modal?.kind === 'sale'}
  <SaleForm id={app.modal.id} />
{/if}

{#if app.toast}
  <div class="toast" class:error={app.toast.error} role="status">{app.toast.msg}</div>
{/if}

<style>
  .shell { min-height: 100dvh; }

  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 15px; letter-spacing: -0.01em; }
  .logo {
    display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px;
    background: var(--accent); color: var(--on-accent);
  }

  /* ---------- Barre latérale (ordinateur) ---------- */
  .sidebar {
    position: fixed; inset: 0 auto 0 0; width: var(--sidebar-w);
    display: flex; flex-direction: column; gap: 20px;
    padding: 20px 14px; background: var(--surface); border-right: 1px solid var(--border);
  }
  .sidebar .brand { padding: 0 8px; }
  .nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .nav-item {
    display: flex; align-items: center; gap: 12px; width: 100%; min-height: 40px; padding: 0 10px;
    border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--text-2);
    font-weight: 550; font-size: 14px; text-align: left; cursor: pointer;
    transition: background var(--dur-fast), color var(--dur-fast);
  }
  .nav-item:hover { background: var(--surface-2); color: var(--text); }
  .nav-item.active { background: var(--accent-soft); color: var(--accent-text); }
  .nav-item span:not(.count) { flex: 1; }
  .count {
    min-width: 22px; height: 20px; padding: 0 6px; border-radius: 999px; display: grid; place-items: center;
    background: var(--warn-soft); color: var(--warn); font-size: 12px; font-weight: 700;
  }
  .nav-sep { height: 1px; background: var(--border); margin: 10px 4px; }

  .user { display: flex; align-items: center; gap: 8px; padding: 10px 8px 0; border-top: 1px solid var(--border); }
  .avatar {
    display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%;
    background: var(--accent-soft); color: var(--accent-text); font-weight: 700;
  }
  .user-name { flex: 1; display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
  .user-name strong { font-size: 14px; }

  .main { margin-left: var(--sidebar-w); padding: 28px 32px 48px; max-width: calc(1240px + var(--sidebar-w)); }


  .topbar, .bottom-nav { display: none; }

  /* ---------- Téléphone et petite tablette ---------- */
  @media (max-width: 900px) {
    .sidebar { display: none; }
    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      position: sticky; top: 0; z-index: 20; height: calc(56px + env(safe-area-inset-top)); padding: 0 8px 0 16px;
      padding-top: env(safe-area-inset-top);
      background: color-mix(in srgb, var(--bg) 85%, transparent); backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .main { margin-left: 0; padding: 16px 16px calc(var(--bottom-nav-h) + 32px + env(safe-area-inset-bottom)); }

    .bottom-nav {
      display: grid; grid-template-columns: repeat(5, 1fr);
      position: fixed; inset: auto 0 0 0; z-index: 30;
      height: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom)); padding-bottom: env(safe-area-inset-bottom);
      background: var(--surface); border-top: 1px solid var(--border);
    }
    .tab {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
      border: 0; background: transparent; color: var(--text-3); font-size: 11px; font-weight: 600; cursor: pointer;
    }
    .tab.active { color: var(--accent-text); }
    .tab-icon { position: relative; display: flex; }
    .tab-dot { position: absolute; top: -1px; right: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--warn); border: 2px solid var(--surface); }

    .more-backdrop { position: fixed; inset: 0; z-index: 25; border: 0; background: var(--overlay); }
    .more-sheet {
      position: fixed; left: 12px; right: 12px; z-index: 26;
      bottom: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom) + 10px);
      padding: 8px; border-radius: var(--radius-lg); background: var(--surface); border: 1px solid var(--border);
      box-shadow: var(--shadow-lg); animation: rise var(--dur) var(--ease-out);
    }
    .more-sheet .nav-item { min-height: 48px; }
  }

  .toast {
    position: fixed; left: 50%; bottom: 24px; z-index: 100; transform: translateX(-50%);
    padding: 12px 18px; border-radius: var(--radius); background: var(--text); color: var(--bg);
    font-size: 14px; font-weight: 550; box-shadow: var(--shadow-lg); animation: rise var(--dur) var(--ease-out);
    max-width: calc(100vw - 32px);
  }
  .toast.error { background: var(--neg); color: #fff; }
  @media (max-width: 900px) { .toast { bottom: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom) + 16px); } }

  @keyframes rise { from { opacity: 0; transform: translate(var(--tx, 0), 8px); } to { opacity: 1; transform: translate(var(--tx, 0), 0); } }
  .toast { --tx: -50%; }
</style>
