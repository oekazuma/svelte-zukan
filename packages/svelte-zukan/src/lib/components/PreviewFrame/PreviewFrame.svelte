<script lang="ts">
  import { flushSync } from 'svelte';
  import type { Messages } from '../../app/i18n.js';
  import A11yPanel from './A11yPanel.svelte';
  import { startMeasure } from './measure.js';
  import {
    BACKGROUND_MODES,
    BACKGROUNDS,
    transparent,
    onBackground,
    readBackground,
    readWidth,
    writeBackground,
    writeWidth,
    type Background,
    type Theme
  } from './storage.js';

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
  const OUTLINE_ICON = ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'];
  const EXPAND_ICON = ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'];
  const COLLAPSE_ICON = ['M9 4v5H4', 'M15 4v5h5', 'M9 20v-5H4', 'M15 20v-5h5'];
  /** in the preview page; `!important`, since the app's own CSS may set outlines */
  const OUTLINE_CSS = '*{outline:1px solid rgb(232 62 140 / 0.6) !important;outline-offset:-1px !important}';
  const LINK_ICON = [
    'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1',
    'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'
  ];
  const CHECK_ICON = ['M5 12.5l4.5 4.5L19 7'];
  const BACKGROUND_ICONS: Record<Background, string[]> = {
    theme: ['M4 4h16v16H4z'],
    checker: ['M4 4h16v16H4z', 'M4 12h16', 'M12 4v16', 'M4 4h8v8H4z', 'M12 12h8v8h-8z'],
    grid: ['M4 4h16v16H4z', 'M4 9.3h16', 'M4 14.7h16', 'M9.3 4v16', 'M14.7 4v16']
  };
  /** the app's CSS may paint the body, which would hide the pattern */
  const backgroundCss = (mode: Background, theme: Theme) => {
    const [base, mark] = theme === 'dark' ? ['#0d1117', '#262c36'] : ['#ffffff', '#e4e6ea'];
    const image =
      mode === 'checker'
        ? `conic-gradient(${mark} 25%, transparent 0 50%, ${mark} 0 75%, transparent 0)`
        : `linear-gradient(to right, ${mark} 1px, transparent 1px), linear-gradient(to bottom, ${mark} 1px, transparent 1px)`;
    return `html{background:${base} ${image} 0 0/16px 16px !important}body{background:transparent !important}`;
  };
  const A11Y_ICON = [
    'M10.5 4.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0',
    'M5 8.5l7 1.5 7-1.5',
    'M12 10v4.5',
    'M8.5 20l3.5-5.5 3.5 5.5'
  ];
  const MEASURE_ICON = ['M3 8h18v8H3z', 'M7 8v3', 'M11 8v4', 'M15 8v3', 'M19 8v4'];
  const OPEN_ICON = ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'];
  const MIN_WIDTH = 200;
  /** a typed width above the stage is drawn at its real width and scaled down, up to a 4K screen */
  const MAX_WIDTH = 3840;
  const MIN_HEIGHT = 80;
  /** the resize grip sits beside the iframe, so the iframe is exactly the chosen width */
  const HANDLE = 14;
  const KEY_STEP = 10;

  let {
    src,
    tabHref,
    shareUrl,
    requestedWidth,
    expanded = $bindable(false),
    axe,
    title,
    theme,
    labels
  }: {
    src: string;
    /** "open in new tab"; unlike `src`, it may carry the theme without reloading the frame */
    tabHref: string;
    /** a link to this view at the given width, for the copy-link button */
    shareUrl?: (width: number | null) => string;
    /** a width from a shared link; it wins over the remembered one */
    requestedWidth?: number;
    expanded?: boolean;
    /** the source of axe-core; without it there is no accessibility check */
    axe?: () => Promise<string>;
    title: string;
    theme: Theme;
    labels: Messages;
  } = $props();

  // null = 100%; the frame is recreated per entry, so `src` is read once
  // svelte-ignore state_referenced_locally
  let width = $state<number | null>(readWidth(src));
  // 0 until measured
  let stageWidth = $state(0);
  let height = $state(MIN_HEIGHT);
  let dragging = $state(false);
  let outlined = $state(false);
  let measuring = $state(false);
  let background = $state<Background>(readBackground());
  // until the first height is measured, a skeleton covers the frame (lazy frames load only when scrolled to)
  let ready = $state(false);
  let expandButton: HTMLButtonElement | undefined = $state();
  let startX = 0;
  let startWidth = 0;

  let observer: ResizeObserver | undefined;
  let doc = $state.raw<Document>();

  // a stage narrower than MIN_WIDTH lowers the minimum, so aria-valuenow never goes below aria-valuemin
  const max = $derived(Math.max(0, stageWidth - HANDLE));
  const min = $derived(Math.min(MIN_WIDTH, max));
  // the width the preview is laid out at; wider than the stage, it is scaled down to fit
  const current = $derived(width === null ? max : Math.min(MAX_WIDTH, Math.max(min, width)));
  const scale = $derived(max > 0 && current > max ? max / current : 1);
  /** narrower than the stage: centered on a patterned stage, so the device's edges are visible */
  const sized = $derived(width !== null && stageWidth > 0 && current < max);

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
    // the target width, not the measured one: a preset change may still be animating
    startWidth = current;
  }

  function onpointermove(e: PointerEvent) {
    // whole pixels: the frame's own width can be fractional, and nobody reads 489.796875px
    // the frame is centered, so its right edge moves half as far as its width changes
    if (dragging) width = clamp(Math.round(startWidth + 2 * (e.clientX - startX)));
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Home') width = min;
    else if (e.key === 'End') width = null;
    // up to MAX_WIDTH, as a typed width: past the stage, it is scaled down
    else if (e.key === 'ArrowRight') width = Math.min(MAX_WIDTH, current + KEY_STEP);
    else if (e.key === 'ArrowLeft') width = Math.max(min, current - KEY_STEP);
    else return;
    e.preventDefault();
  }

  // the preview mounts after the iframe's load event, so watch the body and pick up the wrapper element when it appears
  function observe(doc: Document) {
    observer?.disconnect();
    let target: Element | null = null;
    /** the viewport height the content last matched */
    let tiedTo = -1;
    /** the content's bottom and the viewport height at the previous measurement */
    let last = { bottom: 0, viewport: 0 };
    observer = new ResizeObserver(() => {
      const found = doc.querySelector('[data-zukan-preview]');
      if (!found) return;
      // the app's CSS, which may paint the body, arrives with the content
      paint(doc);
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
      const tied = Math.abs(own - viewport) < 1;
      const grown = bottom - last.bottom;
      const resized = viewport - last.viewport;
      last = { bottom, viewport };
      // content that grew with the viewport holds an element sized to it (`100vh`) next to more content, so it is always
      // taller than the frame: following it would grow the frame without end
      if (ready && Math.abs(resized) >= 1 && Math.abs(grown - resized) < 2) return;
      // a page that fills the viewport has nothing new to measure when the viewport has not changed since, or when the
      // frame is stretched to the expanded stage: measuring it would grow the frame by the body's margins each time
      if (tied && ready && (expanded || Math.abs(tiedTo - viewport) < 1)) return;
      const follows = tied && tiedTo !== -1 && Math.abs(tiedTo - viewport) >= 1;
      if (tied) tiedTo = viewport;
      const next = Math.max(MIN_HEIGHT, follows ? own : Math.ceil(bottom + spacing + scrollbar));
      // resizing the frame inside the callback would resize what is observed in the same frame (a "ResizeObserver loop")
      requestAnimationFrame(() => {
        height = next;
        ready = true;
      });
    });
    observer.observe(doc.body);
  }

  // the preview page has no catalog CSS; `color-scheme` also switches `light-dark()` and form controls in it
  $effect(() => {
    if (!doc) return;
    doc.documentElement.style.colorScheme = theme;
  });

  /**
   * The page's own body color, when it has one and its html has none, for the whole page: an expanded preview is taller
   * than its content.
   * Read after the theme (`light-dark()`) and after a pattern background, which makes the body transparent, changes.
   */
  function paint(page: Document) {
    const view = page.defaultView!;
    const html = page.documentElement;
    // the app's own html background, without the color set here last time
    html.style.backgroundColor = '';
    if (!transparent(view.getComputedStyle(html).backgroundColor)) return;
    const body = view.getComputedStyle(page.body).backgroundColor;
    html.style.backgroundColor = transparent(body) ? BACKGROUNDS[theme] : body;
  }

  $effect(() => {
    if (!doc) return;
    const style = doc.createElement('style');
    style.textContent = OUTLINE_CSS;
    if (outlined) doc.head.append(style);
    return () => style.remove();
  });

  $effect(() => {
    if (!doc || background === 'theme') return;
    const style = doc.createElement('style');
    style.textContent = backgroundCss(background, theme);
    doc.head.append(style);
    return () => style.remove();
  });

  // after the effects above, so it reads the body with the current theme and pattern
  $effect(() => {
    if (!doc || !background) return;
    paint(doc);
  });

  $effect(() => onBackground((value) => (background = value)));

  function nextBackground() {
    writeBackground(BACKGROUND_MODES[(BACKGROUND_MODES.indexOf(background) + 1) % BACKGROUND_MODES.length]);
  }

  const BACKGROUND_LABELS = { theme: 'backgroundTheme', checker: 'backgroundChecker', grid: 'backgroundGrid' } as const;
  const backgroundName = $derived(`${labels.background}: ${labels[BACKGROUND_LABELS[background]]}`);

  function setWidthFrom(input: HTMLInputElement) {
    const value = Math.round(Number(input.value));
    if (input.value !== '' && value > 0) width = Math.min(MAX_WIDTH, Math.max(min, value));
    input.value = String(Math.round(current));
  }

  let a11yOpen = $state(false);
  let iframe: HTMLIFrameElement | undefined = $state();

  $effect(() => {
    if (doc && measuring) return startMeasure(doc);
  });

  // keys pressed in the preview never reach the catalog's window, so its shortcuts would stop once the preview has the
  // focus; the copy goes to the iframe, so the catalog's handlers get an element as the target, as for a key on the page
  $effect(() => {
    const frame = iframe;
    if (!doc || !frame) return;
    const forward = (e: KeyboardEvent) => {
      const target = e.composedPath()[0] as HTMLElement;
      const typing = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      // Escape closes a dialog or a popover open in the preview first, which must not leave the expanded view too
      const closes = e.key === 'Escape' && doc.querySelector('dialog[open], :popover-open');
      if (e.defaultPrevented || e.isComposing || typing || closes) return;
      const { key, code, location, repeat, ctrlKey, shiftKey, altKey, metaKey } = e;
      const copy = { key, code, location, repeat, ctrlKey, shiftKey, altKey, metaKey, bubbles: true, cancelable: true };
      // a shortcut the catalog handled (⌘K) must not also do what the browser does with it
      if (!frame.dispatchEvent(new KeyboardEvent('keydown', copy))) e.preventDefault();
    };
    // on the window, after the page's own handlers on its elements and document, which may take the key
    const view = doc.defaultView!;
    view.addEventListener('keydown', forward);
    return () => view.removeEventListener('keydown', forward);
  });

  function toggleExpanded() {
    expanded = !expanded;
    // the button moves with the toolbar; keep the focus on it
    queueMicrotask(() => expandButton?.focus());
  }

  $effect(() => {
    if (requestedWidth) width = requestedWidth;
  });

  $effect(() => writeWidth(src, width));

  let linkStatus = $state<'idle' | 'copied' | 'failed'>('idle');
  let linkTimer: ReturnType<typeof setTimeout> | undefined;
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl!(width));
      linkStatus = 'copied';
    } catch {
      linkStatus = 'failed';
    }
    clearTimeout(linkTimer);
    linkTimer = setTimeout(() => (linkStatus = 'idle'), 2000);
  }
  $effect(() => () => clearTimeout(linkTimer));

  $effect(() => () => observer?.disconnect());

  // a native `title` shows only after a long delay and never on keyboard focus
  const TIP_TARGETS = 'button, a, [data-tip]';
  const TIP_DELAY = 150;
  const TIP_GAP = 6;
  let tip: HTMLDivElement | undefined = $state();
  let tipText = $state('');
  let tipFor: HTMLElement | null = null;
  let tipTimer: ReturnType<typeof setTimeout> | undefined;
  // toggles rename themselves (expand, background, copy link) while the tip is shown
  const tipLabel = new MutationObserver(() => placeTip());

  function placeTip() {
    if (!tip || !tipFor) return;
    tipText = tipFor.getAttribute('aria-label') ?? tipFor.dataset.tip ?? '';
    // measured below, so the new text must be in the DOM
    flushSync();
    if (!tip.matches(':popover-open')) tip.showPopover();
    const r = tipFor.getBoundingClientRect();
    const { clientWidth, clientHeight } = document.documentElement;
    const centered = r.left + r.width / 2 - tip.offsetWidth / 2;
    const below = r.bottom + TIP_GAP;
    const top = below + tip.offsetHeight > clientHeight ? r.top - TIP_GAP - tip.offsetHeight : below;
    tip.style.left = `${Math.max(TIP_GAP, Math.min(centered, clientWidth - tip.offsetWidth - TIP_GAP))}px`;
    tip.style.top = `${top}px`;
  }

  function showTip(el: HTMLElement, delay: number) {
    if (el === tipFor) return;
    hideTip();
    tipFor = el;
    tipLabel.observe(el, { attributeFilter: ['aria-label', 'data-tip'] });
    tipTimer = setTimeout(placeTip, delay);
  }

  function hideTip() {
    clearTimeout(tipTimer);
    tipLabel.disconnect();
    tipFor = null;
    if (tip?.matches(':popover-open')) tip.hidePopover();
  }

  function tooltips(toolbar: HTMLElement) {
    // Firefox before 125 has no popover; the controls keep their aria-label and go without a tip
    if (!('showPopover' in HTMLElement.prototype)) return;
    const target = (e: Event) => (e.target as Element).closest<HTMLElement>(TIP_TARGETS);
    const over = (e: PointerEvent) => {
      const el = target(e);
      if (el && e.pointerType !== 'touch') showTip(el, TIP_DELAY);
    };
    const out = (e: PointerEvent) => {
      if (tipFor && !tipFor.contains(e.relatedTarget as Node | null) && !tipFor.matches(':focus-visible')) hideTip();
    };
    // a hover tip on another button stays when the previously clicked one loses focus
    const focusout = (e: FocusEvent) => {
      if (e.target === tipFor) hideTip();
    };
    const focusin = (e: FocusEvent) => {
      const el = target(e);
      if (el?.matches(':focus-visible')) showTip(el, 0);
    };
    toolbar.addEventListener('pointerover', over);
    toolbar.addEventListener('pointerout', out);
    toolbar.addEventListener('focusin', focusin);
    toolbar.addEventListener('focusout', focusout);
    return {
      destroy() {
        toolbar.removeEventListener('pointerover', over);
        toolbar.removeEventListener('pointerout', out);
        toolbar.removeEventListener('focusin', focusin);
        toolbar.removeEventListener('focusout', focusout);
        hideTip();
      }
    };
  }
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

<svelte:window
  onscroll={hideTip}
  onresize={hideTip}
  onkeydown={(e) => {
    if (e.key !== 'Escape') return;
    hideTip();
    // Escape in a dialog over the expanded preview closes the dialog only
    if (expanded && !(e.target as Element).closest('dialog')) toggleExpanded();
  }}
/>

{#if expanded}
  <!-- clicking outside the expanded preview also leaves it -->
  <div class="backdrop" aria-hidden="true" onclick={toggleExpanded}></div>
{/if}

<div class={['preview', { expanded }]}>
  <div class="toolbar" use:tooltips>
    <div class="group" role="group" aria-label={labels.previewWidth}>
      {#each PRESETS as preset (preset.width)}
        {@const name = `${labels[preset.label]} (${preset.width}px)`}
        <button
          type="button"
          class="icon"
          aria-label={name}
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
        aria-pressed={width === null}
        onclick={() => (width = null)}
      >
        {@render icon(FULL_ICON)}
      </button>
    </div>
    <!-- not a live region: it would announce every pixel while dragging -->
    <label class="width">
      <input
        type="number"
        inputmode="numeric"
        min={stageWidth ? min : undefined}
        max={MAX_WIDTH}
        aria-label={labels.widthInPixels}
        value={stageWidth ? Math.round(current) : ''}
        onchange={(e) => setWidthFrom(e.currentTarget)}
        onkeydown={(e) => {
          if (e.key === 'Escape') {
            e.currentTarget.value = String(Math.round(current));
            e.currentTarget.blur();
          }
        }}
      /><span class="unit" aria-hidden="true">px</span>
      {#if scale < 1}
        <span class="zoom" data-tip={labels.scaledToFit}>
          {Math.round(scale * 100)}% <span class="sr-only">{labels.scaledToFit}</span>
        </span>
      {/if}
    </label>
    <div class="group">
      <button type="button" class="icon" aria-label={backgroundName} onclick={nextBackground}>
        {@render icon(BACKGROUND_ICONS[background])}
      </button>
      {#if axe}
        <button
          type="button"
          class="icon"
          aria-label={labels.checkA11y}
          aria-pressed={a11yOpen}
          disabled={!doc}
          onclick={() => (a11yOpen = !a11yOpen)}
        >
          {@render icon(A11Y_ICON)}
        </button>
      {/if}
      <button
        type="button"
        class="icon"
        aria-label={labels.measure}
        aria-pressed={measuring}
        onclick={() => (measuring = !measuring)}
      >
        {@render icon(MEASURE_ICON)}
      </button>
      <button
        type="button"
        class="icon"
        aria-label={labels.outline}
        aria-pressed={outlined}
        onclick={() => (outlined = !outlined)}
      >
        {@render icon(OUTLINE_ICON)}
      </button>
      <button
        bind:this={expandButton}
        type="button"
        class="icon"
        aria-label={expanded ? labels.collapse : labels.expand}
        aria-pressed={expanded}
        onclick={toggleExpanded}
      >
        {@render icon(expanded ? COLLAPSE_ICON : EXPAND_ICON)}
      </button>
    </div>
    {#if shareUrl}
      {@const name =
        linkStatus === 'copied' ? labels.copied : linkStatus === 'failed' ? labels.copyFailed : labels.copyLink}
      <button type="button" class="icon" aria-label={name} onclick={copyLink}>
        {@render icon(linkStatus === 'copied' ? CHECK_ICON : LINK_ICON)}
      </button>
      <span class="sr-only" aria-live="polite">{linkStatus === 'idle' ? '' : name}</span>
    {/if}
    <!-- the preview page of this catalog, not a SvelteKit route -->
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a href={tabHref} target="_blank" rel="noopener" aria-label={labels.openInNewTab}>
      {@render icon(OPEN_ICON)}<span class="label">{labels.openInNewTab}</span>
    </a>
  </div>
  <div class={['stage', { sized }]} bind:clientWidth={stageWidth}>
    <div
      class={['frame', { dragging }]}
      style:width={width === null || scale < 1 ? '100%' : `${current + HANDLE}px`}
      style:--handle="{HANDLE}px"
      aria-busy={!ready}
    >
      {#if !ready}
        <div class="skeleton" role="status" aria-label={labels.loading}>
          <span></span><span></span><span></span>
        </div>
      {/if}
      <!-- the iframe's color-scheme is what `prefers-color-scheme` reports inside it -->
      <div
        class={['viewport', { scaled: scale < 1 }]}
        style:height={scale < 1 ? `${Math.ceil(height * scale)}px` : null}
      >
        <iframe
          bind:this={iframe}
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
          style:width={scale < 1 ? `${current}px` : null}
          style:scale={scale < 1 ? scale : null}
          style:color-scheme={theme}
        ></iframe>
      </div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <div
        class={['handle', { dragging }]}
        role="separator"
        aria-orientation="vertical"
        aria-label={labels.previewWidth}
        aria-valuemin={stageWidth ? min : undefined}
        aria-valuemax={stageWidth ? Math.max(max, Math.round(current)) : undefined}
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
  <!-- the top layer escapes the frame's overflow and the page's containment; the name is in aria-label -->
  <div class="tip" popover="manual" aria-hidden="true" bind:this={tip}>{tipText}</div>
  {#if a11yOpen && axe && doc}
    {#key doc}
      <A11yPanel {doc} {axe} {labels} onclose={() => (a11yOpen = false)} />
    {/key}
  {/if}
</div>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* without popover support, the :popover-open rule is dropped and the tip stays hidden */
  .tip {
    display: none;
    inset: auto;
    margin: 0;
    padding: 3px 8px;
    border: 0;
    border-radius: 4px;
    background: var(--_text);
    color: var(--_bg);
    font: 12px/1.4 var(--_font);
    white-space: nowrap;
    pointer-events: none;
  }

  .tip:popover-open {
    display: block;
  }

  .preview {
    border: 1px solid var(--_border);
    border-radius: 6px;
    overflow: hidden;
    font-family: var(--_font);
    color: var(--_text);
  }

  .expanded {
    position: fixed;
    inset: 16px;
    z-index: 20;
    display: flex;
    flex-direction: column;
    background: var(--_bg);
    box-shadow: 0 24px 64px -12px rgb(0 0 0 / 0.45);
  }

  .expanded .stage {
    flex: 1;
    min-height: 40%;
    overflow: auto;
  }

  /* a long list of issues scrolls in the panel, instead of squeezing the stage to nothing and being clipped */
  .expanded > :global(.a11y) {
    min-height: 0;
    max-height: 50%;
    overflow: auto;
  }

  /* at full width the page itself fills the rest of the screen, instead of the stage's grey below it */
  .expanded .stage:not(.sized),
  .expanded .stage:not(.sized) :is(.frame, .viewport:not(.scaled)) {
    display: flex;
    flex-direction: column;
  }

  .expanded .stage:not(.sized) :is(.frame, .viewport:not(.scaled), .viewport:not(.scaled) iframe) {
    flex: 1 0 auto;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 19;
    background: rgb(0 0 0 / 0.45);
  }

  .skeleton {
    position: absolute;
    inset: 0 var(--handle) 0 0;
    display: grid;
    align-content: center;
    gap: 8px;
    padding: 0 24px;
    background: var(--_bg);
  }

  .skeleton span {
    height: 10px;
    border-radius: 5px;
    background: linear-gradient(90deg, var(--_code-bg) 0%, var(--_border) 50%, var(--_code-bg) 100%);
    background-size: 200% 100%;
    animation: shimmer 1.2s ease-in-out infinite;
  }

  .skeleton span:nth-child(2) {
    width: 70%;
  }

  .skeleton span:nth-child(3) {
    width: 45%;
  }

  @keyframes shimmer {
    from {
      background-position: 100% 0;
    }

    to {
      background-position: -100% 0;
    }
  }

  .toolbar {
    container-type: inline-size;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
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
    white-space: nowrap;
    font-family: var(--_mono);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--_text);
  }

  .width input {
    width: 5ch;
    padding: 2px 4px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: none;
    color: inherit;
    font: inherit;
    text-align: right;
    appearance: textfield;
  }

  .width input::-webkit-inner-spin-button,
  .width input::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }

  .width input:hover {
    border-color: var(--_border);
  }

  .width input:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: -1px;
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

    /* the wrapped row of tools reads as one evenly spaced set, and the link is an icon like the others */
    .toolbar {
      column-gap: 2px;
    }

    .toolbar a {
      justify-content: center;
      width: 30px;
      height: 28px;
      padding: 0;
    }
  }

  .stage {
    background: var(--_code-bg);
    transition: padding 0.25s ease;
  }

  .stage.sized {
    padding-block: 20px;
    background-image: radial-gradient(color-mix(in srgb, var(--_muted) 45%, transparent) 1px, transparent 1.5px);
    background-size: 14px 14px;
  }

  .frame {
    position: relative;
    box-sizing: border-box;
    min-width: min(calc(200px + var(--handle)), 100%);
    max-width: 100%;
    margin-inline: auto;
    padding-right: var(--handle);
    background: var(--_bg);
    transition:
      width 0.25s ease,
      box-shadow 0.25s ease;
  }

  .sized .frame {
    border-radius: 8px;
    overflow: hidden;
    box-shadow:
      0 0 0 1px var(--_border),
      0 12px 32px -12px rgb(0 0 0 / 0.35);
  }

  .frame.dragging {
    transition: none;
  }

  iframe {
    display: block;
    width: 100%;
    border: 0;
  }

  .viewport.scaled {
    overflow: hidden;
  }

  .scaled iframe {
    transform-origin: 0 0;
  }

  .zoom {
    margin-left: 6px;
    padding: 1px 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--_accent) 14%, var(--_bg));
    font-size: 12px;
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
