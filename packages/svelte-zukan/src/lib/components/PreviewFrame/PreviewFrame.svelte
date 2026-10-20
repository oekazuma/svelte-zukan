<script lang="ts">
  import { messages, type Messages } from '../../app/i18n.js';
  import { BACKGROUNDS, readWidth, writeWidth, type Theme } from './storage.js';

  const PRESETS = [375, 768, 1024, 1280];
  const MIN_WIDTH = 200;
  const MIN_HEIGHT = 80;
  const KEY_STEP = 10;

  let {
    src,
    title,
    theme = 'light',
    labels = messages.en
  }: {
    src: string;
    title: string;
    /** the catalog's theme, applied to the preview page */
    theme?: Theme;
    labels?: Pick<Messages, 'previewWidth' | 'fullWidth' | 'openInNewTab'>;
  } = $props();

  // null = 100%; the frame is recreated per entry, so `src` is read once
  // svelte-ignore state_referenced_locally
  let width = $state<number | null>(readWidth(src));
  // 0 until measured
  let stageWidth = $state(0);
  let height = $state(MIN_HEIGHT);
  let dragging = $state(false);
  let startX = 0;
  let startWidth = 0;

  let observer: ResizeObserver | undefined;
  let doc = $state.raw<Document>();

  // a stage narrower than MIN_WIDTH lowers the minimum, so aria-valuenow never goes below aria-valuemin
  const min = $derived(Math.min(MIN_WIDTH, stageWidth));
  // the frame is capped by max-width and min-width in CSS, so report the effective width
  const current = $derived(clamp(width ?? stageWidth));

  function clamp(value: number) {
    return Math.min(stageWidth, Math.max(min, value));
  }

  function onpointerdown(e: PointerEvent) {
    if (e.button !== 0) return;
    const handle = e.currentTarget as HTMLElement;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // not an active pointer (synthetic event); dragging still works while the pointer stays on the handle
    }
    dragging = true;
    startX = e.clientX;
    startWidth = handle.parentElement!.getBoundingClientRect().width;
  }

  function onpointermove(e: PointerEvent) {
    if (dragging) width = clamp(startWidth + (e.clientX - startX));
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Home') width = min;
    else if (e.key === 'End') width = null;
    else if (e.key === 'ArrowRight') width = clamp(current + KEY_STEP);
    else if (e.key === 'ArrowLeft') width = clamp(current - KEY_STEP);
    else return;
    e.preventDefault();
  }

  // the preview mounts after the iframe's load event, so watch the body and pick up the wrapper element when it appears
  function observe(doc: Document) {
    observer?.disconnect();
    let target: Element | null = null;
    /** the viewport height the content last matched */
    let tiedTo = -1;
    observer = new ResizeObserver(() => {
      const found = doc.querySelector('[data-zukan-preview]');
      if (!found) return;
      if (found !== target) {
        target = found;
        observer!.observe(found);
      }
      const win = doc.defaultView!;
      const body = win.getComputedStyle(doc.body);
      // the app's CSS (loaded by the wrapper) may pad the body; a horizontal scrollbar takes height too
      const bottom = found.getBoundingClientRect().bottom + win.scrollY;
      const spacing = parseFloat(body.paddingBottom) + parseFloat(body.marginBottom);
      // scrollingElement: in quirks mode (an about:blank test page) documentElement.clientHeight is the content height
      const viewport = (doc.scrollingElement ?? doc.documentElement).clientHeight;
      const scrollbar = win.innerHeight - viewport;
      const own = found.getBoundingClientRect().height;
      // ponytail: content that still matches the viewport after the viewport changed follows it (`100vh`) and would grow
      // with every added pixel, so it keeps its own height and may keep an inner scrollbar; one match is a coincidence
      // (e.g. 80px content in the initial 80px frame). A growth limit would be the upgrade if that matters
      const tied = Math.abs(own - viewport) < 1;
      const follows = tied && tiedTo !== -1 && Math.abs(tiedTo - viewport) >= 1;
      if (tied) tiedTo = viewport;
      const next = Math.max(MIN_HEIGHT, follows ? own : Math.ceil(bottom + spacing + scrollbar));
      // resizing the frame inside the callback would resize what is observed in the same frame (a "ResizeObserver loop")
      requestAnimationFrame(() => (height = next));
    });
    observer.observe(doc.body);
  }

  // the preview page has no catalog CSS; `color-scheme` also switches `light-dark()` and form controls in it
  $effect(() => {
    if (!doc) return;
    doc.documentElement.style.colorScheme = theme;
    doc.documentElement.style.backgroundColor = BACKGROUNDS[theme];
  });

  $effect(() => writeWidth(src, width));

  $effect(() => () => observer?.disconnect());
</script>

<div class="preview">
  <div class="toolbar">
    <div class="group" role="group" aria-label={labels.previewWidth}>
      {#each PRESETS as preset (preset)}
        <button type="button" aria-pressed={width === preset} onclick={() => (width = preset)}>{preset}</button>
      {/each}
      <button type="button" aria-pressed={width === null} onclick={() => (width = null)}>{labels.fullWidth}</button>
    </div>
    <!-- the handle reports the same value (aria-valuenow); a live region here would announce every pixel while dragging -->
    <span class="width" aria-hidden="true">{stageWidth ? `${current}px` : ''}</span>
    <!-- the preview page of this catalog, not a SvelteKit route -->
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a href={src} target="_blank" rel="noopener">{labels.openInNewTab}</a>
  </div>
  <div class="stage" bind:clientWidth={stageWidth}>
    <div class="frame" style:width={width === null ? '100%' : `${width}px`}>
      <!-- the iframe's color-scheme is what `prefers-color-scheme` reports inside it -->
      <iframe
        {src}
        {title}
        loading="lazy"
        onload={(e) => {
          const loaded = (e.currentTarget as HTMLIFrameElement).contentDocument;
          if (!loaded?.body) return;
          doc = loaded;
          observe(loaded);
        }}
        class:dragging
        style:height="{height}px"
        style:color-scheme={theme}
      ></iframe>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <div
        class="handle"
        role="separator"
        aria-orientation="vertical"
        aria-label={labels.previewWidth}
        aria-valuemin={stageWidth ? min : undefined}
        aria-valuemax={stageWidth || undefined}
        aria-valuenow={stageWidth ? current : undefined}
        tabindex="0"
        {onpointerdown}
        {onpointermove}
        onpointerup={() => (dragging = false)}
        onpointercancel={() => (dragging = false)}
        {onkeydown}
      ></div>
    </div>
  </div>
</div>

<style>
  .preview {
    border: 1px solid var(--_border);
    border-radius: 6px;
    overflow: hidden;
    font-family: var(--_font);
    color: var(--_text);
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--_border);
    background: var(--_code-bg);
  }

  .toolbar button {
    padding: 2px 8px;
    border: 1px solid var(--_border);
    border-radius: 4px;
    background: var(--_bg);
    color: var(--_text);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .toolbar button[aria-pressed='true'] {
    border-color: var(--_accent);
    color: var(--_accent);
  }

  .width {
    margin-left: auto;
    font-family: var(--_mono);
    font-size: 12px;
    color: var(--_muted);
  }

  .group {
    display: flex;
    gap: 4px;
  }

  .toolbar a {
    color: var(--_accent);
    font-size: 12px;
  }

  .stage {
    background: var(--_code-bg);
  }

  .frame {
    position: relative;
    min-width: min(200px, 100%);
    max-width: 100%;
    background: var(--_bg);
  }

  iframe {
    display: block;
    width: 100%;
    border: 0;
  }

  iframe.dragging {
    pointer-events: none;
  }

  .handle {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 8px;
    cursor: ew-resize;
    touch-action: none;
    background: var(--_border);
  }

  .handle:hover,
  .handle:focus-visible {
    background: var(--_accent);
  }
</style>
