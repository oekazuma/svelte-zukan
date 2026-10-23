<script lang="ts">
  import { untrack } from 'svelte';
  import type { Messages } from '../../app/i18n.js';
  import { findTarget, messageOf, runAxe, type AxeResult, type Impact, type Violation } from './run-axe.js';

  type Vision = keyof typeof VISION_FILTERS;

  const IMPACT_LABELS = {
    critical: 'impactCritical',
    serious: 'impactSerious',
    moderate: 'impactModerate',
    minor: 'impactMinor'
  } as const;
  const IMPACT_COLORS: Record<Impact, string> = {
    critical: '#d93a4a',
    serious: '#d93a4a',
    moderate: '#d97706',
    minor: '#2f81f7'
  };
  /** color matrices for the dichromacies and achromatopsia; `blurred` is a plain CSS blur */
  const VISION_FILTERS = {
    none: null,
    blurred: null,
    protanopia: '0.567 0.433 0 0 0 0.558 0.442 0 0 0 0 0.242 0.758 0 0 0 0 0 1 0',
    deuteranopia: '0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0',
    tritanopia: '0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0',
    achromatopsia: '0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0 0 0 1 0'
  } as const;
  const VISIONS = Object.keys(VISION_FILTERS) as Vision[];
  const VISION_HINTS = {
    none: null,
    blurred: 'visionHintBlurred',
    protanopia: 'visionHintProtanopia',
    deuteranopia: 'visionHintDeuteranopia',
    tritanopia: 'visionHintTritanopia',
    achromatopsia: 'visionHintAchromatopsia'
  } as const;
  const RERUN_ICON = ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7'];
  const CLOSE_ICON = ['M6 6l12 12', 'M18 6L6 18'];
  const VISION_LABELS = {
    none: 'visionNone',
    blurred: 'visionBlurred',
    protanopia: 'visionProtanopia',
    deuteranopia: 'visionDeuteranopia',
    tritanopia: 'visionTritanopia',
    achromatopsia: 'visionAchromatopsia'
  } as const;

  let {
    doc,
    axe,
    frame,
    labels,
    onclose
  }: {
    /** the preview page; the panel is recreated when it reloads, so a check runs again after every edit */
    doc: Document;
    axe: () => Promise<string>;
    /** to scroll the catalog page to an element inside the preview */
    frame: HTMLIFrameElement | undefined;
    labels: Messages;
    onclose: () => void;
  } = $props();

  let result = $state<{ status: 'running' } | ({ status: 'done' } & AxeResult) | { status: 'failed'; message: string }>(
    { status: 'running' }
  );
  let highlight = $state(true);
  let selected = $state<string | null>(null);
  /** under the pointer or the focus in the list; it is emphasized like the selected one */
  let hovered = $state<string | null>(null);
  let vision = $state<Vision>('none');
  const uid = $props.id();

  /** a radio group: arrow keys, Home and End move the choice, and the focus with it */
  function moveVision(e: KeyboardEvent) {
    const i = VISIONS.indexOf(vision);
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? (i + 1) % VISIONS.length
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? (i - 1 + VISIONS.length) % VISIONS.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? VISIONS.length - 1
              : -1;
    if (next === -1) return;
    e.preventDefault();
    vision = VISIONS[next];
    ((e.currentTarget as HTMLElement).parentElement!.children[next + 1] as HTMLElement).focus();
  }

  async function check() {
    result = { status: 'running' };
    selected = null;
    try {
      result = { status: 'done', ...(await runAxe(doc, axe)) };
    } catch (e) {
      result = { status: 'failed', message: messageOf(e) };
    }
  }

  $effect(() => {
    untrack(check);
  });

  function select(target: string) {
    selected = selected === target ? null : target;
    if (!selected) return;
    const el = findTarget(doc, target)?.el;
    if (!el || !frame) return;
    const top = frame.getBoundingClientRect().top + el.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight - 40)
      scrollTo({
        top: scrollY + top - innerHeight / 3,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
      });
  }

  /** outlines every reported element in its impact's color, dashed when it needs a manual check; the selected one thicker */
  $effect(() => {
    if (!highlight || result.status !== 'done') return;
    const outline = (list: Violation[], style: string) =>
      list.flatMap((v) =>
        v.targets.flatMap((t) => {
          const found = findTarget(doc, t);
          if (!found) return [];
          const width = t === selected || t === hovered ? 4 : 2;
          const rule = `${found.selector}{outline:${width}px ${style} ${IMPACT_COLORS[v.impact ?? 'minor']} !important;outline-offset:2px !important}`;
          return [{ root: found.root, rule }];
        })
      );
    // a violation's outline wins over a review's on the same element
    const rules = [...outline(result.review, 'dashed'), ...outline(result.violations, 'solid')];
    // the page's styles do not reach into a shadow root, so each root gets its own
    const roots = rules.map((r) => r.root).filter((root, i, all) => all.indexOf(root) === i);
    const styles = roots.map((root) => {
      const style = doc.createElement('style');
      style.textContent = rules
        .filter((r) => r.root === root)
        .map((r) => r.rule)
        .join('\n');
      (root === doc ? doc.head : root).append(style);
      return style;
    });
    return () => styles.forEach((s) => s.remove());
  });

  $effect(() => {
    if (vision === 'none') return;
    const matrix = VISION_FILTERS[vision];
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('style', 'position:absolute;width:0;height:0');
    svg.innerHTML = matrix
      ? `<filter id="zukan-vision"><feColorMatrix type="matrix" values="${matrix}"/></filter>`
      : '';
    const style = doc.createElement('style');
    style.textContent = `html{filter:${matrix ? 'url(#zukan-vision)' : 'blur(2px)'} !important}`;
    doc.body.append(svg);
    doc.head.append(style);
    return () => {
      svg.remove();
      style.remove();
    };
  });
</script>

{#snippet rules(list: Violation[], review: boolean)}
  <ul class={{ review }}>
    {#each list as v (v.id)}
      <li>
        {#if v.impact}<span class={['impact', !review && v.impact]}>{labels[IMPACT_LABELS[v.impact]]}</span>{/if}
        {v.help}
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a href={v.helpUrl} target="_blank" rel="noopener">{labels.a11yLearnMore}</a>
        <ul class="targets">
          {#each v.targets as target, i (i)}
            <li>
              <button
                type="button"
                class="target"
                aria-pressed={selected === target}
                style:--impact={IMPACT_COLORS[v.impact ?? 'minor']}
                onclick={() => select(target)}
                onpointerenter={() => (hovered = target)}
                onpointerleave={() => (hovered = null)}
                onfocus={() => (hovered = target)}
                onblur={() => (hovered = null)}><code>{target}</code></button
              >
            </li>
          {/each}
        </ul>
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet icon(paths: readonly string[])}
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
    {#each paths as d (d)}<path {d} />{/each}
  </svg>
{/snippet}

<div class="a11y">
  <!-- the swatches below show each simulation with the same filters as the preview -->
  <svg class="defs" aria-hidden="true">
    {#each VISIONS as v (v)}
      {#if VISION_FILTERS[v]}
        <filter id="{uid}-{v}"><feColorMatrix type="matrix" values={VISION_FILTERS[v]} /></filter>
      {/if}
    {/each}
  </svg>
  <div class="head">
    <p class="status" aria-live="polite">
      {#if result.status === 'running'}
        {labels.a11yChecking}
      {:else if result.status === 'failed'}
        {labels.a11yFailed} {result.message}
      {:else if result.violations.length}
        {labels.a11yIssues} ({result.violations.length})
      {:else if result.review.length}
        {labels.a11yReview} ({result.review.length})
      {:else}
        <span class="passed">{labels.a11yPassed}</span>
      {/if}
    </p>
    <button type="button" class="action" disabled={result.status === 'running'} onclick={check}>
      {@render icon(RERUN_ICON)}{labels.a11yRerun}
    </button>
    <button type="button" class="close" aria-label={labels.close} title={labels.close} onclick={onclose}>
      {@render icon(CLOSE_ICON)}
    </button>
  </div>
  <div class="vision" role="radiogroup" aria-labelledby="{uid}-vision">
    <span class="caption" id="{uid}-vision">{labels.vision}</span>
    {#each VISIONS as v (v)}
      {@const hint = VISION_HINTS[v]}
      <button
        type="button"
        role="radio"
        class="chip"
        aria-checked={vision === v}
        tabindex={vision === v ? 0 : -1}
        title={hint ? labels[hint] : undefined}
        onclick={() => (vision = v)}
        onkeydown={moveVision}
      >
        <span
          class="swatch"
          aria-hidden="true"
          style:filter={VISION_FILTERS[v] ? `url(#${uid}-${v})` : v === 'blurred' ? 'blur(1.5px)' : undefined}
        ></span>
        {labels[VISION_LABELS[v]]}
      </button>
    {/each}
  </div>
  {#if result.status === 'done' && (result.violations.length || result.review.length)}
    <label class="toggle">
      <input type="checkbox" role="switch" bind:checked={highlight} />
      {labels.a11yHighlight}
    </label>
    {#if result.violations.length}
      {@render rules(result.violations, false)}
    {/if}
    {#if result.review.length}
      <p class="review-head">
        <!-- without violations, the status line above already says this -->
        {#if result.violations.length}<strong>{labels.a11yReview} ({result.review.length})</strong>{/if}
        <span>{labels.a11yReviewHint}</span>
      </p>
      {@render rules(result.review, true)}
    {/if}
  {/if}
</div>

<style>
  .close {
    padding: 3px 6px;
  }

  .a11y {
    border-top: 1px solid var(--_border);
    padding: 10px 14px;
    font-size: 13px;
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .status {
    margin: 0 auto 0 0;
    font-weight: 600;
  }

  .defs {
    position: absolute;
    width: 0;
    height: 0;
  }

  .vision {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
  }

  .caption {
    margin-right: 4px;
    color: var(--_muted);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px 3px 4px;
    border: 1px solid var(--_border);
    border-radius: 999px;
    background: var(--_bg);
    color: var(--_text);
    font: inherit;
    cursor: pointer;
  }

  .chip:hover {
    background: var(--_code-bg);
  }

  .chip[aria-checked='true'] {
    border-color: var(--_accent);
    background: color-mix(in srgb, var(--_accent) 12%, var(--_bg));
    box-shadow: inset 0 0 0 1px var(--_accent);
    font-weight: 600;
  }

  .chip:focus-visible,
  .head button:focus-visible,
  .target:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 1px;
  }

  /* four hues that the simulations tell apart differently */
  .swatch {
    /* a color sample: forced colors mode would replace it with the system's */
    forced-color-adjust: none;
    width: 28px;
    height: 16px;
    border-radius: 999px;
    background: linear-gradient(90deg, #e53935 0 25%, #43a047 25% 50%, #1e88e5 50% 75%, #fdd835 75%);
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    color: var(--_muted);
    cursor: pointer;
  }

  .passed {
    color: var(--_success);
  }

  .head button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border: 1px solid var(--_border);
    border-radius: 6px;
    background: var(--_bg);
    color: var(--_text);
    font: inherit;
    cursor: pointer;
  }

  ul {
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  li + li {
    margin-top: 8px;
  }

  a {
    color: var(--_accent);
  }

  .targets {
    margin: 4px 0 0;
  }

  .review-head {
    margin: 16px 0 0;
  }

  .review-head span {
    display: block;
    margin-top: 2px;
    color: var(--_muted);
  }

  .review .target {
    border-left-style: dashed;
  }

  .targets li {
    margin: 2px 0 0;
  }

  .target {
    padding: 1px 6px;
    border: 1px solid transparent;
    border-left: 3px solid var(--impact);
    border-radius: 4px;
    background: none;
    color: var(--_muted);
    font-family: var(--_mono);
    font-size: 12px;
    text-align: left;
    overflow-wrap: anywhere;
    cursor: pointer;
  }

  .target:hover,
  .target[aria-pressed='true'] {
    background: var(--_code-bg);
    color: var(--_text);
  }

  /* forced colors mode drops the background, shadow and border color that mark these, but keeps an outline */
  @media (forced-colors: active) {
    .chip[aria-checked='true'],
    .target[aria-pressed='true'] {
      outline: 2px solid Highlight;
      outline-offset: 1px;
    }
  }

  .impact {
    margin-right: 6px;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--_code-bg);
    font-size: 11px;
    font-weight: 600;
  }

  .impact.critical,
  .impact.serious {
    background: var(--_danger-bg);
    color: var(--_danger);
  }
</style>
