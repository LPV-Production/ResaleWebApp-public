<script lang="ts">
  import { eur, eur0 } from '../lib/format';

  type Month = { label: string; full: string; profit: number; count: number };
  let { months }: { months: Month[] } = $props();

  // Graphique en barres dessiné en SVG (pas de bibliothèque externe).
  const W = 600, H = 220, PAD_L = 44, PAD_B = 28, PAD_T = 16;
  const innerH = H - PAD_B - PAD_T;

  const maxV = $derived(Math.max(10, ...months.map((m) => m.profit)));
  const minV = $derived(Math.min(0, ...months.map((m) => m.profit)));
  // Graduation "ronde" (ex. 0 / 50 / 100 / 150)
  const step = $derived.by(() => {
    const raw = (maxV - minV) / 3;
    const mag = 10 ** Math.floor(Math.log10(raw));
    return Math.ceil(raw / mag) * mag;
  });
  const top = $derived(Math.ceil(maxV / step) * step);
  const bottom = $derived(Math.floor(minV / step) * step);
  const ticks = $derived(Array.from({ length: Math.round((top - bottom) / step) + 1 }, (_, i) => bottom + i * step));
  const y = (v: number) => PAD_T + ((top - v) / (top - bottom)) * innerH;

  const slot = $derived((W - PAD_L) / months.length);
  const barW = $derived(Math.min(44, slot * 0.56));

  let hover = $state<number | null>(null);
  const current = $derived(hover ?? months.length - 1);
</script>

<div class="chart">
  <div class="readout" aria-live="polite">
    <span class="muted small">{months[current].full}</span>
    <strong class="num" class:neg={months[current].profit < 0}>{eur(months[current].profit)}</strong>
    <span class="muted small">{months[current].count} vente{months[current].count > 1 ? 's' : ''}</span>
  </div>

  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Bénéfice net par mois sur 6 mois">
    {#each ticks as t}
      <line x1={PAD_L} x2={W} y1={y(t)} y2={y(t)} class="grid" class:zero={t === 0} />
      <text x={PAD_L - 8} y={y(t) + 4} class="tick" text-anchor="end">{eur0(t).replace(/\s?€/, '')}</text>
    {/each}

    {#each months as m, i}
      {@const x = PAD_L + slot * i + (slot - barW) / 2}
      {@const y0 = y(Math.max(0, m.profit))}
      {@const h = Math.max(2, Math.abs(y(m.profit) - y(0)))}
      <g
        role="button"
        tabindex="0"
        aria-label="{m.full} : {eur(m.profit)}"
        onmouseenter={() => (hover = i)}
        onmouseleave={() => (hover = null)}
        onfocus={() => (hover = i)}
        onblur={() => (hover = null)}
      >
        <rect x={PAD_L + slot * i} y={PAD_T} width={slot} height={innerH} fill="transparent" />
        <rect {x} y={y0} width={barW} height={h} rx="6" class="bar" class:negbar={m.profit < 0} class:dim={current !== i} />
        <text x={x + barW / 2} y={H - 8} text-anchor="middle" class="label" class:active={current === i}>{m.label}</text>
      </g>
    {/each}
  </svg>
</div>

<style>
  .chart { display: flex; flex-direction: column; gap: 8px; }
  .readout { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .readout strong { font-size: 20px; font-weight: 700; }
  svg { width: 100%; height: auto; display: block; overflow: visible; }
  .grid { stroke: var(--chart-grid); stroke-width: 1; }
  .grid.zero { stroke: var(--border-strong); }
  .tick { fill: var(--text-3); font-size: 11px; font-variant-numeric: tabular-nums; }
  .label { fill: var(--text-3); font-size: 12px; font-weight: 550; text-transform: capitalize; }
  .label.active { fill: var(--text); }
  .bar { fill: var(--chart-pos); transition: opacity var(--dur-fast); }
  .bar.negbar { fill: var(--chart-neg); }
  .bar.dim { opacity: 0.45; }
  g { cursor: pointer; outline: none; }
  g:focus-visible .bar { stroke: var(--text); stroke-width: 2; }
</style>
