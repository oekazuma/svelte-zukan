<script lang="ts">
  import { BACKGROUNDS, type Theme } from '../components/PreviewFrame/storage.js';
  import type { Entry } from '../types.js';
  import { formatHash } from './hash.js';

  /** the width a thumbnail is laid out at; it is scaled down to the card */
  const LAYOUT_WIDTH = 480;
  const THUMB_HEIGHT = 150;
  /** a thumbnail is a picture of the first example: it never scrolls, and its content sits in the middle unless it is taller */
  const THUMB_CSS =
    'html,body{overflow:hidden !important}' +
    '[data-zukan-preview]{box-sizing:border-box;min-height:100vh;padding:24px;' +
    'display:flex;flex-direction:column;justify-content:safe center}';

  let { entry, theme }: { entry: Entry; theme: Theme } = $props();

  let width = $state(0);
  let doc = $state.raw<Document>();
  const scale = $derived(width ? width / LAYOUT_WIDTH : 1);
  const hue = $derived([...entry.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 11));

  /** the first paragraph of the .md, as text */
  function summary(html: string | null) {
    if (!html) return null;
    const p = new DOMParser().parseFromString(html, 'text/html').querySelector('p');
    return p?.textContent?.trim() || null;
  }

  $effect(() => {
    if (!doc) return;
    doc.documentElement.style.colorScheme = theme;
    doc.documentElement.style.backgroundColor = BACKGROUNDS[theme];
  });
</script>

<article class="card">
  <!-- inert: a picture of the example, not something to use or tab into -->
  <div class="thumb" inert bind:clientWidth={width}>
    {#await entry.meta() then { default: meta }}
      {#if meta.sections.length}
        <iframe
          src={location.pathname + formatHash('preview', entry.path, meta.sections[0].title)}
          title={entry.name}
          loading="lazy"
          style:width="{LAYOUT_WIDTH}px"
          style:height="{THUMB_HEIGHT / scale}px"
          style:scale
          style:color-scheme={theme}
          onload={(e) => {
            const loaded = (e.currentTarget as HTMLIFrameElement).contentDocument;
            if (!loaded?.head) return;
            const style = loaded.createElement('style');
            style.textContent = THUMB_CSS;
            loaded.head.append(style);
            doc = loaded;
          }}
        ></iframe>
      {:else}
        <span class="mark" style:--hue={hue}>{entry.name[0]}</span>
      {/if}
    {/await}
  </div>
  <div class="text">
    <!-- the catalog is a hash-routed SPA outside SvelteKit, so resolve() does not apply -->
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a href={formatHash('detail', entry.path)}>{entry.name}</a>
    {#if entry.dir}<span class="dir">{entry.dir}</span>{/if}
    {#await entry.meta() then { default: meta }}
      {@const text = summary(meta.doc)}
      {#if text}<p>{text}</p>{/if}
    {/await}
  </div>
</article>

<style>
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
    display: grid;
    place-items: center;
    height: 150px;
    overflow: hidden;
    border-bottom: 1px solid var(--_border);
    background: var(--_code-bg);
  }

  iframe {
    display: block;
    align-self: start;
    justify-self: start;
    border: 0;
    transform-origin: 0 0;
  }

  .mark {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    /* dark enough for white text at every hue */
    background: hsl(var(--hue) 60% 42%);
    color: #fff;
    font-size: 22px;
    font-weight: 700;
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
    overflow-wrap: anywhere;
  }

  p {
    display: -webkit-box;
    margin: 4px 0 0;
    overflow: hidden;
    color: var(--_muted);
    font-size: 13px;
    line-height: 1.5;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
</style>
