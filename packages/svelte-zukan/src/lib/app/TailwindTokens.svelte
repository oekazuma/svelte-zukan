<!-- mounted into the sample iframe: injected styles land in the document it is mounted in, not the catalog's -->
<svelte:options css="injected" />

<script lang="ts" module>
  import type { TailwindCategoryId, TailwindToken } from '../types.js';

  /** the categories drawn as one row per token, to compare sizes at a glance */
  const ROWS: TailwindCategoryId[] = [
    'border-color',
    'padding',
    'margin',
    'spacing',
    'width',
    'height',
    'breakpoints',
    'border-width',
    'border-radius',
    'opacity',
    'z-index'
  ];

  /** the property whose computed value is shown next to a token's value */
  const MEASURED: Partial<Record<TailwindCategoryId, string>> = {
    padding: 'padding-top',
    margin: 'margin-top',
    spacing: 'width',
    width: 'width',
    height: 'height',
    'font-size': 'font-size',
    'letter-spacing': 'letter-spacing',
    'line-height': 'line-height',
    'border-radius': 'border-top-left-radius',
    'border-width': 'border-top-width',
    breakpoints: 'width'
  };

  const LENGTH = /\d(?:r?em|px|r?ch|r?ex|r?lh|pt|pc|in|cm|mm|q)\b/i;
  // these follow the frame, whose height follows its content (`h-screen` would never settle); `infinity` is `rounded-full`
  const RELATIVE = /%|infinity|\d(?:[sld]?v(?:[hwib]|min|max)|cq(?:[hwib]|min|max))\b/i;

  const key = (token: TailwindToken) => token.class ?? token.cssVariable;
</script>

<script lang="ts">
  import type { Theme } from '../components/PreviewFrame/storage.js';
  import type { TailwindCategory } from '../types.js';
  import type { Messages } from './i18n.js';
  import { filterTokens } from './tailwind-filter.js';

  let {
    category,
    kind,
    query,
    sampleText,
    theme,
    t
  }: { category: TailwindCategory; kind: string; query: string; sampleText: string; theme: Theme; t: Messages } =
    $props();

  const tokens = $derived(filterTokens(category.tokens, query));
  const text = $derived(kind === 'text' || kind === 'text-color');
  const rows = $derived(ROWS.includes(category.id));
  const sampled = $derived(category.id !== 'z-index');
  /** a length drawn as a bar across the whole row */
  const bars = $derived(['spacing', 'width', 'height'].includes(category.id));

  /** px by token, for the values that do not depend on the frame */
  let measured = $state.raw<Record<string, number>>({});
  const widest = $derived(Math.max(0, ...Object.values(measured)));

  // every token of the category, not only the filtered ones: the breakpoint bars keep their scale under a filter
  function measure(root: HTMLElement) {
    const property = MEASURED[category.id];
    const out: Record<string, number> = {};
    if (property) {
      const doc = root.ownerDocument;
      const probe = doc.createElement('div');
      // a border width computes to 0 without a style
      probe.style.cssText = 'position:absolute;visibility:hidden;border:0 solid';
      root.append(probe);
      const style = doc.defaultView!.getComputedStyle(probe);
      for (const token of category.tokens) {
        if (!LENGTH.test(token.value) || RELATIVE.test(token.value)) continue;
        // an invalid value is dropped and would leave the previous token's in place
        probe.style.removeProperty(property);
        probe.style.setProperty(property, token.value);
        if (probe.style.getPropertyValue(property) === '') continue;
        const px = parseFloat(style.getPropertyValue(property));
        if (Number.isFinite(px)) out[key(token)!] = px;
      }
      probe.remove();
    }
    measured = out;
  }

  /** marks a bar longer than its track, which is capped at the track and would otherwise look like an exact fit */
  function cutOff(px: number) {
    return (bar: HTMLElement) => {
      const track = bar.parentElement!;
      const observer = new ResizeObserver(() => {
        const style = getComputedStyle(track);
        const room = track.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        bar.toggleAttribute('data-cut', px > room + 0.5);
      });
      observer.observe(track);
      return () => observer.disconnect();
    };
  }

  function computed(token: TailwindToken): string | null {
    const px = measured[key(token)!];
    if (px === undefined) return null;
    const shown = `${Math.round(px * 100) / 100}px`;
    return shown === token.value ? null : shown;
  }

  let copied = $state<{ text: string; ok: boolean } | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      copied = { text: value, ok: true };
    } catch {
      // clipboard unavailable (insecure context, denied)
      copied = { text: value, ok: false };
    }
    clearTimeout(timer);
    timer = setTimeout(() => (copied = null), 2000);
  }

  $effect(() => () => clearTimeout(timer));
</script>

{#snippet copyButton(label: string, value: string)}
  {@const failed = copied?.text === value && !copied.ok}
  <button
    type="button"
    class={['zukan-copy', failed && 'zukan-failed']}
    aria-label="{label}: {value}"
    title={label}
    onclick={() => copy(value)}
  >
    <code>{value}</code>
    {#if failed}
      <span class="zukan-status">{t.copyFailed}</span>
    {/if}
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {#if copied?.text === value && copied.ok}
        <path d="M5 12.5l4.5 4.5L19 7" />
      {:else}
        <path d="M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z" />
        <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
      {/if}
    </svg>
  </button>
{/snippet}

{#snippet names(token: TailwindToken)}
  {#if token.class}
    {@render copyButton(t.copyClass, token.class)}
  {/if}
  {#if token.cssVariable}
    {@render copyButton(t.copyVariable, token.cssVariable)}
  {/if}
{/snippet}

{#snippet value(token: TailwindToken)}
  {@const px = computed(token)}
  <code class="zukan-raw">{token.value}</code>
  {#if px}
    <span class="zukan-px"
      ><span aria-hidden="true">·</span> <span class="zukan-sr-only">{t.computedSize}:</span> <code>{px}</code></span
    >
  {/if}
{/snippet}

{#snippet rowSample(token: TailwindToken)}
  {@const px = measured[key(token)!]}
  {#if category.id === 'padding'}
    <div class={['zukan-pad', token.class]}><div class="zukan-block"></div></div>
  {:else if category.id === 'margin'}
    <div class="zukan-margin-area"><div class={['zukan-block', token.class]}></div></div>
  {:else if category.id === 'breakpoints'}
    {#if px !== undefined && widest > 0}
      <div class="zukan-bar" style:width="{(px / widest) * 100}%"></div>
    {/if}
  {:else if category.id === 'border-color'}
    <div class={['zukan-ring', token.class]}></div>
  {:else if category.id === 'border-width'}
    <div class={['zukan-shape zukan-outline', token.class]}></div>
  {:else if category.id === 'border-radius' || category.id === 'opacity'}
    <div class={['zukan-shape', token.class]}></div>
  {:else if px !== undefined}
    <!-- Width, Height and Spacing draw the length as a bar; a value that follows the frame has none -->
    <div class="zukan-bar" style:width={token.value} {@attach cutOff(px)}></div>
  {/if}
{/snippet}

<!-- class names are prefixed: the entry's own CSS is in this document and may style `.card` or `.sample` -->
<div class="zukan-tokens" data-theme={theme} {@attach measure}>
  <!-- first: at the end, its static position would put it 1px below the content the frame is sized to -->
  <p class="zukan-sr-only" aria-live="polite">{copied ? (copied.ok ? t.copied : t.copyFailed) : ''}</p>
  {#if !tokens.length}
    <p class="zukan-empty">{t.noTokens}</p>
  {:else if rows}
    <ul class={['zukan-rows', !sampled && 'zukan-bare', bars && 'zukan-bars']}>
      {#each tokens as token (key(token))}
        <!-- a length that follows the frame has no bar, and so no panel to draw it in -->
        {@const drawn = sampled && !(bars && measured[key(token)!] === undefined)}
        <li class={['zukan-row', !drawn && 'zukan-unsampled']} data-token={key(token)}>
          {#if drawn}
            <div class="zukan-sample zukan-{category.id}">{@render rowSample(token)}</div>
          {/if}
          <div class="zukan-names">{@render names(token)}</div>
          <div class="zukan-values">{@render value(token)}</div>
        </li>
      {/each}
    </ul>
  {:else}
    <ul class="zukan-cards">
      {#each tokens as token (key(token))}
        <li class={['zukan-card', kind === 'text' && 'zukan-wide']} data-token={key(token)}>
          <div class="zukan-sample zukan-{kind} zukan-{category.id}">
            {#if category.id === 'drop-shadow'}
              <!-- a filter shadow follows the shape it is drawn around -->
              <svg class={token.class} viewBox="0 0 24 24" width="64" height="64" aria-hidden="true">
                <path
                  fill="#fff"
                  d="M12 2l2.9 6.26 6.85.71-5.12 4.6 1.45 6.73L12 16.9l-6.08 3.4 1.45-6.73-5.12-4.6 6.85-.71z"
                />
              </svg>
            {:else}
              <div class={['zukan-value', token.class]}>
                {#if text}{sampleText}{/if}
              </div>
            {/if}
          </div>
          <div class="zukan-names">
            {@render names(token)}
            <span class="zukan-values">{@render value(token)}</span>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  /* the catalog's theme for the cards only; the samples keep the light document they are drawn in */
  .zukan-tokens {
    --_bg: #fff;
    --_text: #1f2328;
    --_muted: #59636e;
    --_border: #d1d9e0;
    --_accent: #0969da;
    --_code-bg: #f6f8fa;
    --_success: #1a7f37;
    --_danger: #cf222e;

    color: var(--_text);
    font-family: system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }

  .zukan-tokens[data-theme='dark'] {
    --_bg: #0d1117;
    --_text: #f0f6fc;
    --_muted: #9198a1;
    --_border: #3d444d;
    --_accent: #4493f8;
    --_code-bg: #151b23;
    --_success: #3fb950;
    --_danger: #ff7b72;
  }

  .zukan-cards,
  .zukan-rows {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .zukan-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .zukan-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    border: 1px solid var(--_border);
    border-radius: 8px;
    background: var(--_bg);
    overflow: hidden;
  }

  .zukan-wide {
    grid-column: 1 / -1;
  }

  /* an inset panel, always light like the rest of the sample document */
  .zukan-sample {
    /* a sample of the token: forced colors mode would replace its colors and backgrounds with the system's */
    forced-color-adjust: none;
    min-width: 0;
    border: 1px solid var(--_border);
    border-radius: 6px;
    background: #fff;
    color: #000;
    overflow: hidden;
  }

  .zukan-card .zukan-sample {
    margin: 8px 8px 0;
    padding: 8px;
    overflow: auto;
  }

  .zukan-value {
    min-width: 0;
  }

  .zukan-color .zukan-value {
    height: 80px;
    border-radius: 4px;
  }

  .zukan-text-color .zukan-value {
    min-height: 80px;
  }

  .zukan-text .zukan-value {
    overflow-wrap: anywhere;
  }

  /* a white shape on grey, with room below for the largest shadows */
  .zukan-card .zukan-box-shadow,
  .zukan-card .zukan-drop-shadow {
    display: flex;
    justify-content: center;
    padding: 24px 24px 40px;
    background: #f1f3f5;
    overflow: hidden;
  }

  .zukan-box-shadow .zukan-value {
    width: 64px;
    height: 64px;
    border-radius: 6px;
    background: #fff;
  }

  .zukan-drop-shadow svg {
    display: block;
  }

  .zukan-rows {
    border: 1px solid var(--_border);
    border-radius: 8px;
    background: var(--_bg);
  }

  .zukan-row {
    display: grid;
    grid-template-columns: minmax(0, 4fr) minmax(0, 5fr) minmax(0, 4fr);
    grid-template-areas: 'sample names value';
    align-items: center;
    gap: 6px 16px;
    padding: 6px 12px;
  }

  .zukan-row + .zukan-row {
    border-top: 1px solid var(--_border);
  }

  .zukan-bare .zukan-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas: 'names value';
  }

  /* the frame's own width */
  @media (width < 560px) {
    .zukan-row {
      grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
      grid-template-areas: 'sample names' 'sample value';
    }
  }

  /* the bar takes the row's whole width under its names, so long lengths stay apart */
  .zukan-bars .zukan-row {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas: 'names value' 'sample sample';
  }

  .zukan-bars .zukan-unsampled {
    grid-template-areas: 'names value';
  }

  .zukan-bars .zukan-values {
    justify-self: end;
    text-align: right;
  }

  /* one height for every row; larger samples are clipped, their size is in the value column */
  .zukan-row .zukan-sample {
    grid-area: sample;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    height: 40px;
    padding: 0 12px;
  }

  .zukan-row .zukan-sample > * {
    flex: none;
  }

  /* drawn like the browser's box model: padding green, margin orange, content blue */
  .zukan-pad {
    display: flex;
    background: #bbf7d0;
  }

  .zukan-margin-area {
    display: flow-root;
    background: #fed7aa;
  }

  .zukan-block {
    width: 16px;
    height: 16px;
    background: #3b82f6;
  }

  .zukan-bars .zukan-sample {
    height: 32px;
  }

  .zukan-bar {
    max-width: 100%;
    height: 16px;
    border-radius: 2px;
    background: #3b82f6;
  }

  /* a fading end over the last stretch of the track; `data-cut` is set by `cutOff`, outside the markup */
  .zukan-bar:global([data-cut]) {
    border-radius: 2px 0 0 2px;
    mask-image: linear-gradient(to right, #000 calc(100% - 48px), transparent);
  }

  .zukan-shape {
    width: 64px;
    height: 28px;
    background: #3b82f6;
  }

  /* taller than the row, so that only the top corners show and large radii stay apart */
  .zukan-border-radius .zukan-shape {
    align-self: flex-start;
    width: 96px;
    height: 80px;
    margin-top: 8px;
  }

  /* the token's class sets the colour, so no `border` shorthand here; the hairlines on both sides of the band keep
     a near-white border such as `border-red-50` visible on the white panel */
  .zukan-ring {
    box-sizing: border-box;
    width: 64px;
    height: 28px;
    border-width: 4px;
    border-style: solid;
    border-radius: 4px;
    background: #fff;
    box-shadow:
      0 0 0 1px #d1d9e0,
      inset 0 0 0 1px #d1d9e0;
  }

  .zukan-outline {
    border-style: solid;
    border-color: #1f2328;
    background: #dbeafe;
  }

  .zukan-names {
    grid-area: names;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    min-width: 0;
  }

  .zukan-card .zukan-names {
    padding: 8px 10px;
  }

  .zukan-values {
    grid-area: value;
    min-width: 0;
  }

  code {
    font-family: ui-monospace, monospace;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .zukan-copy {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    margin: 0;
    padding: 2px 6px;
    border: 1px solid var(--_border);
    border-radius: 6px;
    background: var(--_code-bg);
    color: var(--_text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .zukan-copy:hover {
    border-color: var(--_accent);
  }

  .zukan-copy:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 1px;
  }

  .zukan-failed {
    border-color: var(--_danger);
    color: var(--_danger);
  }

  .zukan-status {
    font-size: 12px;
  }

  .zukan-copy svg {
    flex: none;
    color: var(--_muted);
  }

  .zukan-raw,
  .zukan-px {
    color: var(--_muted);
  }

  .zukan-px code {
    color: var(--_text);
  }

  .zukan-empty {
    margin: 0;
    color: var(--_muted);
  }

  .zukan-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
