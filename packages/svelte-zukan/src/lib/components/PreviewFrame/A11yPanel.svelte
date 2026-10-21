<script lang="ts">
  import { untrack } from 'svelte';
  import type { Messages } from '../../app/i18n.js';

  type Impact = 'critical' | 'serious' | 'moderate' | 'minor';
  type Violation = { id: string; impact: Impact | null; help: string; helpUrl: string; targets: string[] };
  type AxeWindow = Window & {
    axe?: {
      run(
        context: Element,
        options: object
      ): Promise<{
        violations: {
          id: string;
          impact?: Impact | null;
          help: string;
          helpUrl: string;
          nodes: { target: unknown[] }[];
        }[];
      }>;
    };
  };
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
    labels: Pick<
      Messages,
      | 'a11yChecking'
      | 'a11yPassed'
      | 'a11yIssues'
      | 'a11yFailed'
      | 'a11yLearnMore'
      | 'a11yRerun'
      | 'a11yHighlight'
      | 'impactCritical'
      | 'impactSerious'
      | 'impactModerate'
      | 'impactMinor'
      | 'vision'
      | 'visionNone'
      | 'visionBlurred'
      | 'visionProtanopia'
      | 'visionDeuteranopia'
      | 'visionTritanopia'
      | 'visionAchromatopsia'
      | 'close'
    >;
    onclose: () => void;
  } = $props();

  let result = $state<
    { status: 'running' } | { status: 'done'; violations: Violation[] } | { status: 'failed'; message: string }
  >({ status: 'running' });
  let highlight = $state(true);
  let selected = $state<string | null>(null);
  let vision = $state<Vision>('none');
  const selectId = $props.id();

  async function check() {
    result = { status: 'running' };
    selected = null;
    try {
      const win = doc.defaultView as AxeWindow;
      if (!win.axe) {
        const script = doc.createElement('script');
        script.textContent = await axe();
        doc.head.append(script);
      }
      // `region` asks for landmarks around all content, which a component on its own never has
      const found = await win.axe!.run(doc.querySelector('[data-zukan-preview]') ?? doc.body, {
        resultTypes: ['violations'],
        rules: { region: { enabled: false } }
      });
      result = {
        status: 'done',
        violations: found.violations.map((v) => ({
          id: v.id,
          impact: v.impact ?? null,
          help: v.help,
          helpUrl: v.helpUrl,
          targets: v.nodes.map((n) => n.target.join(' '))
        }))
      };
    } catch (e) {
      // an error thrown by axe comes from the preview page's realm, so `instanceof Error` does not see it
      const message = e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
      result = { status: 'failed', message };
    }
  }

  $effect(() => {
    untrack(check);
  });

  function select(target: string) {
    selected = selected === target ? null : target;
    if (!selected) return;
    const el = doc.querySelector(target);
    if (!el || !frame) return;
    const top = frame.getBoundingClientRect().top + el.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight - 40) scrollTo({ top: scrollY + top - innerHeight / 3, behavior: 'smooth' });
  }

  /** outlines every reported element in its impact's color; the selected one thicker */
  $effect(() => {
    if (!highlight || result.status !== 'done') return;
    const rules = result.violations.flatMap((v) =>
      v.targets.map(
        (t) =>
          `${t}{outline:${t === selected ? 4 : 2}px solid ${IMPACT_COLORS[v.impact ?? 'minor']} !important;outline-offset:2px !important}`
      )
    );
    const style = doc.createElement('style');
    style.textContent = rules.join('\n');
    doc.head.append(style);
    return () => style.remove();
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

<div class="a11y">
  <div class="head">
    <p aria-live="polite">
      {#if result.status === 'running'}
        {labels.a11yChecking}
      {:else if result.status === 'failed'}
        {labels.a11yFailed} {result.message}
      {:else if !result.violations.length}
        <span class="passed">{labels.a11yPassed}</span>
      {:else}
        {labels.a11yIssues} ({result.violations.length})
      {/if}
    </p>
    {#if result.status === 'done' && result.violations.length}
      <label><input type="checkbox" bind:checked={highlight} /> {labels.a11yHighlight}</label>
    {/if}
    <label for="{selectId}-vision">{labels.vision}</label>
    <select id="{selectId}-vision" bind:value={vision}>
      {#each Object.keys(VISION_FILTERS) as Vision[] as v (v)}
        <option value={v}>{labels[VISION_LABELS[v]]}</option>
      {/each}
    </select>
    <button type="button" disabled={result.status === 'running'} onclick={check}>{labels.a11yRerun}</button>
    <button type="button" onclick={onclose}>{labels.close}</button>
  </div>
  {#if result.status === 'done' && result.violations.length}
    <ul>
      {#each result.violations as v (v.id)}
        <li>
          {#if v.impact}<span class={['impact', v.impact]}>{labels[IMPACT_LABELS[v.impact]]}</span>{/if}
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
                  onclick={() => select(target)}><code>{target}</code></button
                >
              </li>
            {/each}
          </ul>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
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

  .head p {
    margin: 0 auto 0 0;
    font-weight: 600;
  }

  .passed {
    color: var(--_success);
  }

  .head label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--_muted);
  }

  .head :is(button, select) {
    padding: 2px 10px;
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
