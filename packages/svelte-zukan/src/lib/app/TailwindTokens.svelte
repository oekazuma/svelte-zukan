<!-- mounted into the sample iframe: injected styles land in the document it is mounted in, not the catalog's -->
<svelte:options css="injected" />

<script lang="ts">
  import type { Theme } from '../components/PreviewFrame/storage.js';
  import type { TailwindCategory } from '../types.js';
  import type { Messages } from './i18n.js';

  let {
    category,
    kind,
    query,
    sampleText,
    theme,
    t
  }: { category: TailwindCategory; kind: string; query: string; sampleText: string; theme: Theme; t: Messages } =
    $props();

  const tokens = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return category.tokens;
    return category.tokens.filter((token) =>
      [token.class, token.cssVariable, token.value].some((s) => s?.toLowerCase().includes(q))
    );
  });
  const text = $derived(kind === 'text' || kind === 'text-color');
  const wide = $derived(['text', 'width', 'padding', 'margin'].includes(kind));

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
  <button type="button" class="zukan-copy" aria-label="{label}: {value}" title={label} onclick={() => copy(value)}>
    <code>{value}</code>
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

<!-- class names are prefixed: the entry's own CSS is in this document and may style `.card` or `.sample` -->
<div class="zukan-tokens" data-theme={theme}>
  {#if tokens.length}
    <ul class="zukan-cards">
      {#each tokens as token (token.class ?? token.cssVariable)}
        <li class={['zukan-card', wide && 'zukan-wide']} data-token={token.class ?? token.cssVariable}>
          {#if kind !== 'value'}
            <div class="zukan-sample zukan-{kind}">
              <!-- Spacing shows the padding value as a bar, as the class would pad instead of size it -->
              <div
                class={['zukan-value', category.id !== 'spacing' && token.class]}
                style:width={category.id === 'spacing' ? token.value : undefined}
              >
                {#if kind === 'padding' || kind === 'margin'}
                  <div class="zukan-inner"></div>
                {:else if text}
                  {sampleText}
                {/if}
              </div>
            </div>
          {/if}
          <div class="zukan-names">
            {#if token.class}
              {@render copyButton(t.copyClass, token.class)}
            {/if}
            {#if token.cssVariable}
              {@render copyButton(t.copyVariable, token.cssVariable)}
            {/if}
            <code class="zukan-raw">{token.value}</code>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="zukan-empty">{t.noTokens}</p>
  {/if}
  <p class="zukan-sr-only" aria-live="polite">{copied ? (copied.ok ? t.copied : t.copyFailed) : ''}</p>
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
  }

  .zukan-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
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

  /* always light, like the rest of the sample document */
  .zukan-sample {
    min-width: 0;
    max-width: 100%;
    overflow: auto;
    padding: 8px;
    border-bottom: 1px solid var(--_border);
    background: #fff;
    color: #000;
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

  /* the token's class sets the colour, so no `border` shorthand here */
  .zukan-border-color .zukan-value {
    height: 80px;
    border-width: 2px;
    border-style: solid;
    border-radius: 4px;
  }

  .zukan-text .zukan-value {
    overflow-wrap: anywhere;
  }

  .zukan-box,
  .zukan-border {
    padding: 24px;
  }

  .zukan-box .zukan-value,
  .zukan-border .zukan-value {
    width: 96px;
    height: 96px;
    background: rgb(113 113 122 / 0.5);
  }

  .zukan-border .zukan-value {
    border-style: solid;
  }

  .zukan-width .zukan-value {
    height: 32px;
    background: rgb(113 113 122 / 0.5);
  }

  /* `h-screen` is 100vh of this frame, and the frame grows with its content */
  .zukan-height {
    max-height: 240px;
  }

  .zukan-height .zukan-value {
    width: 64px;
    background: rgb(113 113 122 / 0.5);
  }

  .zukan-padding .zukan-value {
    width: fit-content;
    background: rgb(113 113 122 / 0.15);
  }

  .zukan-margin {
    border: 1px dashed rgb(113 113 122 / 0.5);
  }

  .zukan-margin .zukan-value {
    display: flow-root;
  }

  .zukan-inner {
    width: 48px;
    height: 48px;
    background: rgb(113 113 122 / 0.5);
  }

  .zukan-names {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    padding: 8px 10px;
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

  .zukan-copy svg {
    flex: none;
    color: var(--_muted);
  }

  .zukan-raw {
    color: var(--_muted);
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
