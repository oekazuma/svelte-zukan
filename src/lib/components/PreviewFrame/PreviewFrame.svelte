<script lang="ts">
  import { messages, type Messages } from '../../app/i18n.js';

  const PRESETS = [375, 768, 1024, 1280];
  const MIN_WIDTH = 200;
  const MIN_HEIGHT = 80;
  const KEY_STEP = 10;

  let {
    src,
    title,
    labels = messages.en
  }: { src: string; title: string; labels?: Pick<Messages, 'previewWidth' | 'fullWidth'> } = $props();

  // null = 100%
  let width = $state<number | null>(null);
  // 0 until measured
  let stageWidth = $state(0);
  let height = $state(MIN_HEIGHT);
  let dragging = $state(false);
  let startX = 0;
  let startWidth = 0;

  let observer: ResizeObserver | undefined;

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
    observer = new ResizeObserver(() => {
      const found = doc.querySelector('[data-zukan-preview]');
      if (!found) return;
      if (found !== target) {
        target = found;
        observer!.observe(found);
      }
      height = Math.max(MIN_HEIGHT, found.getBoundingClientRect().height);
    });
    observer.observe(doc.body);
  }

  $effect(() => () => observer?.disconnect());
</script>

<div class="preview">
  <div class="toolbar">
    {#each PRESETS as preset (preset)}
      <button type="button" aria-pressed={width === preset} onclick={() => (width = preset)}>{preset}</button>
    {/each}
    <button type="button" aria-pressed={width === null} onclick={() => (width = null)}>{labels.fullWidth}</button>
    <output>{stageWidth ? `${current}px` : ''}</output>
  </div>
  <div class="stage" bind:clientWidth={stageWidth}>
    <div class="frame" style:width={width === null ? '100%' : `${width}px`}>
      <iframe
        {src}
        {title}
        onload={(e) => {
          const doc = (e.currentTarget as HTMLIFrameElement).contentDocument;
          if (doc?.body) observe(doc);
        }}
        class:dragging
        style:height="{height}px"
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

  output {
    margin-left: auto;
    font-family: var(--_mono);
    font-size: 12px;
    color: var(--_muted);
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
