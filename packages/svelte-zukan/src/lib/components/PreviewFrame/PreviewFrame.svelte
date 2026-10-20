<script lang="ts">
  import { messages, type Messages } from '../../app/i18n.js';
  import { BACKGROUNDS, readWidth, writeWidth, type Theme } from './storage.js';

  /** typical widths of each kind of screen; the icons are 24×24 stroke paths */
  const PRESETS = [
    {
      width: 375,
      label: 'mobile',
      icon: [
        'M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5z',
        'M11 18h2'
      ]
    },
    {
      width: 768,
      label: 'tablet',
      icon: ['M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M11 17.5h2']
    },
    {
      width: 1024,
      label: 'laptop',
      icon: ['M5.5 5h13A1.5 1.5 0 0 1 20 6.5V16H4V6.5A1.5 1.5 0 0 1 5.5 5z', 'M2 19h20']
    },
    {
      width: 1280,
      label: 'desktop',
      icon: [
        'M4.5 4h15A1.5 1.5 0 0 1 21 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 14.5v-9A1.5 1.5 0 0 1 4.5 4z',
        'M12 16v4',
        'M8.5 20h7'
      ]
    }
  ] as const;
  const FULL_ICON = ['M4 12h16', 'M7.5 8.5 4 12l3.5 3.5', 'M16.5 8.5 20 12l-3.5 3.5'];
  const OPEN_ICON = ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'];
  const MIN_WIDTH = 200;
  const MIN_HEIGHT = 80;
  /** the resize grip sits beside the iframe, so the iframe is exactly the chosen width */
  const HANDLE = 14;
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
    labels?: Pick<Messages, 'previewWidth' | 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'fullWidth' | 'openInNewTab'>;
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
  // the widest the iframe can be: the stage minus the grip
  const max = $derived(Math.max(0, stageWidth - HANDLE));
  const min = $derived(Math.min(MIN_WIDTH, max));
  // the frame is capped by max-width and min-width in CSS, so report the effective width
  const current = $derived(clamp(width ?? max));

  function clamp(value: number) {
    return Math.min(max, Math.max(min, value));
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
    startWidth = handle.parentElement!.getBoundingClientRect().width - HANDLE;
  }

  function onpointermove(e: PointerEvent) {
    // whole pixels: the frame's own width can be fractional, and nobody reads 489.796875px
    if (dragging) width = clamp(Math.round(startWidth + (e.clientX - startX)));
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

{#snippet icon(paths: readonly string[])}
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {#each paths as d (d)}<path {d} />{/each}
  </svg>
{/snippet}

<div class="preview">
  <div class="toolbar">
    <div class="group" role="group" aria-label={labels.previewWidth}>
      {#each PRESETS as preset (preset.width)}
        {@const name = `${labels[preset.label]} (${preset.width}px)`}
        <button
          type="button"
          class="icon"
          aria-label={name}
          title={name}
          aria-pressed={width === preset.width}
          onclick={() => (width = preset.width)}
        >
          {@render icon(preset.icon)}
        </button>
      {/each}
      <button
        type="button"
        class="icon"
        aria-label={labels.fullWidth}
        title={labels.fullWidth}
        aria-pressed={width === null}
        onclick={() => (width = null)}
      >
        {@render icon(FULL_ICON)}
      </button>
    </div>
    <!-- the handle reports the same value (aria-valuenow); a live region here would announce every pixel while dragging -->
    <span class="width" aria-hidden="true">
      {#if stageWidth}{Math.round(current)}<span class="unit">px</span>{/if}
    </span>
    <!-- the preview page of this catalog, not a SvelteKit route -->
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a href={src} target="_blank" rel="noopener" aria-label={labels.openInNewTab} title={labels.openInNewTab}>
      {@render icon(OPEN_ICON)}<span class="label">{labels.openInNewTab}</span>
    </a>
  </div>
  <div class="stage" bind:clientWidth={stageWidth}>
    <div class="frame" style:width={width === null ? '100%' : `${width + HANDLE}px`} style:--handle="{HANDLE}px">
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
        class={['handle', { dragging }]}
        role="separator"
        aria-orientation="vertical"
        aria-label={labels.previewWidth}
        aria-valuemin={stageWidth ? min : undefined}
        aria-valuemax={stageWidth ? max : undefined}
        aria-valuenow={stageWidth ? Math.round(current) : undefined}
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
    container-type: inline-size;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--_border);
    background: var(--_code-bg);
  }

  .group {
    display: flex;
    gap: 2px;
  }

  .icon {
    display: inline-grid;
    place-items: center;
    width: 30px;
    height: 28px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 6px;
    background: none;
    color: var(--_muted);
    cursor: pointer;
  }

  .icon:hover {
    background: var(--_bg);
    color: var(--_text);
  }

  .icon[aria-pressed='true'] {
    border-color: color-mix(in srgb, var(--_accent) 40%, transparent);
    background: color-mix(in srgb, var(--_accent) 12%, var(--_bg));
    color: var(--_accent);
  }

  .icon:focus-visible,
  .toolbar a:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 1px;
  }

  .width {
    margin-left: auto;
    font-family: var(--_mono);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--_text);
  }

  .unit {
    margin-left: 1px;
    color: var(--_muted);
  }

  .toolbar a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 6px;
    color: var(--_accent);
    font-size: 13px;
    text-decoration: none;
  }

  .toolbar a:hover {
    background: var(--_bg);
  }

  /* a narrow toolbar keeps the icon; the link's name stays in aria-label */
  @container (max-width: 380px) {
    .label {
      display: none;
    }
  }

  .stage {
    background: var(--_code-bg);
  }

  .frame {
    position: relative;
    box-sizing: border-box;
    min-width: min(calc(200px + var(--handle)), 100%);
    max-width: 100%;
    padding-right: var(--handle);
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

  /* a grip on the frame's edge rather than a full-height bar, which reads as a scrollbar */
  .handle {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: var(--handle);
    cursor: ew-resize;
    touch-action: none;
    border-left: 1px solid var(--_border);
    background: var(--_code-bg);
  }

  /* two short lines, the usual sign of a splitter */
  .handle::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 6px;
    height: 24px;
    max-height: calc(100% - 12px);
    background: linear-gradient(90deg, currentColor 0 2px, transparent 2px 4px, currentColor 4px 6px);
    color: var(--_muted);
    opacity: 0.6;
    transform: translate(-50%, -50%);
    transition:
      opacity 0.15s,
      color 0.15s;
  }

  .handle:hover::after,
  .handle:focus-visible::after,
  .handle.dragging::after {
    color: var(--_accent);
    opacity: 1;
  }

  .handle:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: -2px;
  }
</style>
