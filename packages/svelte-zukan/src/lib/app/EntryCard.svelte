<script lang="ts">
  import { BACKGROUNDS, transparent, type Theme } from '../components/PreviewFrame/storage.js';
  import type { Entry } from '../types.js';
  import { formatHash } from './hash.js';
  import { fitThumb } from './thumb-fit.js';

  /** the width a thumbnail is laid out at, whatever it is scaled to, so the example's layout never depends on the card */
  const LAYOUT_WIDTH = 480;
  const THUMB_HEIGHT = 150;
  /** tall enough to cover the card at the smallest scale `fitThumb` gives */
  const LAYOUT_HEIGHT = 500;
  /** a thumbnail is a picture of the first example: it never scrolls */
  /** elements that draw their own content, whatever their background */
  const DRAWN = ['img', 'svg', 'video', 'canvas', 'iframe', 'input', 'select', 'textarea', 'progress', 'meter'];
  const THUMB_CSS = 'html,body{overflow:hidden !important}[data-zukan-preview]{box-sizing:border-box;padding:24px}';

  let { entry, theme }: { entry: Entry; theme: Theme } = $props();

  let width = $state(0);
  let doc = $state.raw<Document>();
  /** where the example's content is drawn; until it is measured, the page fills the card's width */
  let fit = $state.raw<ReturnType<typeof fitThumb>>();
  const scale = $derived(fit?.scale ?? (width ? width / LAYOUT_WIDTH : 1));
  /** the background behind the example, such as the page's own body color; the card and the page's edges take it */
  let paint = $state<string>();
  // a whole grapheme, so an emoji sequence or a flag is not cut in half
  const initial = $derived([...new Intl.Segmenter().segment(entry.name)][0]?.segment);
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
    doc.documentElement.style.backgroundColor = paint ?? BACKGROUNDS[theme];
  });

  /** measures the visible content of the example, again whenever it mounts, loads or changes size */
  $effect(() => {
    // the theme changes the page's colors, and so the paint
    if (!doc || !width || !theme) return;
    const view = doc.defaultView!;
    let pending = 0;
    const measure = () => {
      pending = 0;
      const root = doc!.querySelector('[data-zukan-preview]');
      if (!root) return;
      // the html element is left out: this card colors it
      paint = undefined;
      for (let el: Element | null = root; el && el !== doc!.documentElement; el = el.parentElement) {
        const color = view.getComputedStyle(el).backgroundColor;
        if (!transparent(color)) {
          paint = color;
          break;
        }
      }
      let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
      const grow = (box: DOMRect) => {
        if (!box.width || !box.height) return;
        [left, top] = [Math.min(left, box.left), Math.min(top, box.top)];
        [right, bottom] = [Math.max(right, box.right), Math.max(bottom, box.bottom)];
      };
      const shown = (el: Element) => el.checkVisibility({ visibilityProperty: true, opacityProperty: true });
      // a box counts when it is drawn; a wrapper that only holds space, such as a min-height for a modal, does not
      for (const el of root.querySelectorAll('*')) {
        if (!shown(el)) continue;
        const style = view.getComputedStyle(el);
        if (
          DRAWN.includes(el.localName) ||
          style.backgroundImage !== 'none' ||
          !transparent(style.backgroundColor) ||
          [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].some(
            (w) => parseFloat(w) > 0
          )
        )
          grow(el.getBoundingClientRect());
      }
      // text by its own extent: the box of a paragraph spans the whole width however short its line is
      const range = doc!.createRange();
      const texts = doc!.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = texts.nextNode(); node; node = texts.nextNode()) {
        if (!node.textContent?.trim() || !node.parentElement || !shown(node.parentElement)) continue;
        range.selectNodeContents(node);
        grow(range.getBoundingClientRect());
      }
      if (left === Infinity) return;
      // the page never scrolls, so these are its own coordinates, which the whole frame is moved by
      fit = fitThumb({ left, top, width: right - left, height: bottom - top }, width, THUMB_HEIGHT);
    };
    const later = () => (pending ||= view.requestAnimationFrame(measure));
    measure();
    const resized = new view.ResizeObserver(later);
    resized.observe(doc.body);
    const changed = new view.MutationObserver(later);
    changed.observe(doc.body, { subtree: true, childList: true });
    return () => {
      view.cancelAnimationFrame(pending);
      resized.disconnect();
      changed.disconnect();
    };
  });
</script>

<article class="card">
  <!-- inert: a picture of the example, not something to use or tab into -->
  <!-- the preview's own background, so the card shows no edge where the scaled page ends -->
  <div
    class="thumb"
    inert
    bind:clientWidth={width}
    style:background-color={doc ? (paint ?? BACKGROUNDS[theme]) : undefined}
  >
    {#await entry.meta() then { default: meta }}
      {#if meta.sections.length}
        <iframe
          src={location.pathname + formatHash('preview', entry.path, meta.sections[0].title)}
          title={entry.name}
          loading="lazy"
          style:width="{LAYOUT_WIDTH}px"
          style:height="{fit ? LAYOUT_HEIGHT : THUMB_HEIGHT / scale}px"
          style:scale
          style:translate={fit ? `${fit.x * scale}px ${fit.y * scale}px` : undefined}
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
        <span class="mark" style:--hue={hue}>{initial}</span>
      {/if}
    {:catch}
      <span class="mark" style:--hue={hue}>{initial}</span>
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
    {:catch}
      <!-- no summary then; without a catch the rejection would go unhandled -->
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
    /* white text on it stays above 3:1 (large text) at every hue; yellow (60) is the lowest, at 3.44:1 */
    background: hsl(var(--hue) 60% 35%);
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
