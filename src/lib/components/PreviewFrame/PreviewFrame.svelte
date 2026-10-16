<script lang="ts">
  const PRESETS = [375, 768, 1024, 1280];
  const MIN_WIDTH = 200;
  const MIN_HEIGHT = 80;
  const KEY_STEP = 10;

  let { src, title }: { src: string; title: string } = $props();

  // null = 100%
  let width = $state<number | null>(null);
  let stageWidth = $state(0);
  let height = $state(MIN_HEIGHT);
  let dragging = $state(false);
  let startX = 0;
  let startWidth = 0;

  let frame: HTMLDivElement;
  let iframe: HTMLIFrameElement;
  let observer: ResizeObserver | undefined;

  const current = $derived(width ?? stageWidth);

  function clamp(value: number) {
    return Math.min(stageWidth, Math.max(MIN_WIDTH, value));
  }

  function onpointerdown(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging = true;
    startX = e.clientX;
    startWidth = frame.getBoundingClientRect().width;
  }

  function onpointermove(e: PointerEvent) {
    if (dragging) width = clamp(startWidth + (e.clientX - startX));
  }

  function onkeydown(e: KeyboardEvent) {
    const delta = e.key === 'ArrowRight' ? KEY_STEP : e.key === 'ArrowLeft' ? -KEY_STEP : 0;
    if (!delta) return;
    e.preventDefault();
    width = clamp(current + delta);
  }

  function observe(el: HTMLIFrameElement) {
    observer?.disconnect();
    const target = el.contentDocument?.querySelector('[data-zukan-preview]');
    if (!target) return;
    observer = new ResizeObserver(() => {
      height = Math.max(MIN_HEIGHT, target.getBoundingClientRect().height);
    });
    observer.observe(target);
  }

  $effect(() => {
    // the iframe may already be loaded when this runs (hydration), so onload alone can be missed
    if (iframe.contentDocument?.readyState === 'complete') observe(iframe);
    return () => observer?.disconnect();
  });
</script>

<div class="preview">
  <div class="toolbar">
    {#each PRESETS as preset (preset)}
      <button type="button" aria-pressed={width === preset} onclick={() => (width = preset)}>{preset}</button>
    {/each}
    <button type="button" aria-pressed={width === null} onclick={() => (width = null)}>100%</button>
    <output>{current}px</output>
  </div>
  <div class="stage" bind:clientWidth={stageWidth}>
    <div class="frame" bind:this={frame} style:width={width === null ? '100%' : `${width}px`}>
      <iframe
        bind:this={iframe}
        {src}
        {title}
        onload={(e) => observe(e.currentTarget as HTMLIFrameElement)}
        class:dragging
        style:height="{height}px"
      ></iframe>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <div
        class="handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="プレビューの幅"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={stageWidth}
        aria-valuenow={current}
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
    right: -4px;
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
