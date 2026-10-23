<script lang="ts">
  import type { TailwindListItem, TailwindSource } from '../types.js';
  import { formatTailwindHash } from './hash.js';
  import type { Messages } from './i18n.js';
  import { isColor } from './tailwind-filter.js';

  let { item, t }: { item: TailwindListItem; t: Messages } = $props();

  // an entry with an error, or one that fails to load, shows its error on the page it links to; never rejects, as an
  // `{#await}` without `{:catch}` would rethrow
  const data = $derived(item.error ? null : item.load().catch(() => null));
  const id = $props.id();

  /** one shade per palette reads as the theme at a glance; a palette without a 500 shows its first colours */
  function swatches({ categories }: TailwindSource) {
    const colors = (categories.find((c) => c.id === 'background-color')?.tokens ?? []).filter((token) =>
      isColor(token.value)
    );
    const mid = colors.filter((token) => token.class?.endsWith('-500'));
    return (mid.length >= 4 ? mid : colors).slice(0, 24).map((token) => token.value);
  }
</script>

<article class="card">
  {#await data then loaded}
    {@const colors = loaded ? swatches(loaded.default) : []}
    {#if colors.length}
      <!-- the theme's own colours as plain inline colours: the entry's CSS never enters the catalog document -->
      <div class="thumb" aria-hidden="true">
        {#each colors as color, i (i)}
          <span style:background-color={color}></span>
        {/each}
      </div>
    {/if}
  {/await}
  <div class="text">
    <!-- the catalog is a hash-routed SPA outside SvelteKit, so resolve() does not apply -->
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a href={formatTailwindHash(item.id)} aria-describedby="{id}-about">{item.file}</a>
    <span class="dir" id="{id}-about">
      {t.tailwind}{#await data then loaded}{loaded?.default.version ? ` v${loaded.default.version}` : ''}{/await}
    </span>
    {#await data then loaded}
      {#if loaded && !loaded.default.error}
        {@const source = loaded.default}
        <dl>
          <div>
            <dt>{t.tokenCount}</dt>
            <dd>{source.categories.reduce((n, c) => n + c.tokens.length, 0)}</dd>
          </div>
          <div>
            <dt>{t.variableCount}</dt>
            <dd>{Object.keys(source.variables).length}</dd>
          </div>
        </dl>
      {/if}
    {/await}
  </div>
</article>

<style>
  /* drawn like a component's card */
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    border: 1px solid var(--_border);
    border-radius: 12px;
    background: var(--_bg);
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .card:hover {
    border-color: var(--_accent);
    box-shadow: 0 4px 16px -6px color-mix(in srgb, var(--_accent) 45%, transparent);
  }

  .card:has(a:focus-visible) {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }

  .thumb {
    /* the theme colors: forced colors mode would replace them with the system's */
    forced-color-adjust: none;
    display: flex;
    height: 56px;
    border-bottom: 1px solid var(--_border);
  }

  .thumb span {
    flex: 1;
  }

  .text {
    display: grid;
    gap: 2px;
    padding: 12px 14px 14px;
    min-width: 0;
  }

  a {
    color: var(--_text);
    font-weight: 600;
    text-decoration: none;
    overflow-wrap: anywhere;
  }

  a:focus-visible {
    outline: none;
  }

  /* the whole card follows the link */
  a::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  .dir {
    color: var(--_muted);
    font-size: 12px;
  }

  dl {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 6px 0 0;
    font-size: 13px;
  }

  dl div {
    display: flex;
    gap: 6px;
  }

  dt {
    color: var(--_muted);
  }

  dd {
    margin: 0;
    color: var(--_text);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
</style>
