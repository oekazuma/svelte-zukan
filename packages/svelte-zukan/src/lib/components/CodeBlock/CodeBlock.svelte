<script lang="ts">
  import { messages, type Messages } from '../../app/i18n.js';
  import { highlight } from './tokenize.js';

  let {
    code,
    labels = messages.en,
    open = $bindable(false)
  }: {
    /** the source to show and copy */
    code: string;
    /** UI strings; the catalog passes those of its `locale` */
    labels?: Pick<Messages, 'code' | 'copy' | 'copied' | 'copyFailed'>;
    /** whether the code is shown; it starts closed */
    open?: boolean;
  } = $props();
  let status = $state<'idle' | 'copied' | 'failed'>('idle');
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      status = 'copied';
    } catch {
      // clipboard unavailable (insecure context, denied)
      status = 'failed';
    }
    clearTimeout(timer);
    timer = setTimeout(() => (status = 'idle'), 2000);
  }

  $effect(() => () => clearTimeout(timer));

  const parts = $derived(highlight(code));
</script>

<div class="code-block">
  <details bind:open>
    <summary>{labels.code}</summary>
    <!-- after <summary>, which may not hold interactive content, and drawn on its row: it exists only while the code is shown, and the code starts right below the row -->
    {#if open}
      <button type="button" class={['copy', status]} onclick={copy} aria-live="polite">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          {#if status === 'copied'}
            <path d="M5 12.5l4.5 4.5L19 7" />
          {:else}
            <path d="M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z" />
            <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
          {/if}
        </svg>
        {status === 'copied' ? labels.copied : status === 'failed' ? labels.copyFailed : labels.copy}
      </button>
    {/if}
    <!-- the copy button copies `code` itself, not these parts -->
    <pre><code
        >{#each parts as part, i (i)}{#if part.kind}<span class={part.kind}>{part.text}</span
            >{:else}{part.text}{/if}{/each}</code
      ></pre>
  </details>
</div>

<style>
  .code-block {
    position: relative;
    border: 1px solid var(--_border);
    border-radius: 6px;
    font-family: var(--_font);
    color: var(--_text);
  }

  summary {
    padding: 0 12px;
    font-size: 13px;
    line-height: 40px;
    color: var(--_muted);
    cursor: pointer;
  }

  summary:hover {
    color: var(--_text);
  }

  .copy {
    position: absolute;
    top: 6px;
    right: 8px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 12px;
    border: 1px solid var(--_border);
    border-radius: 6px;
    background: var(--_bg);
    color: var(--_text);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background-color 0.15s,
      border-color 0.15s,
      color 0.15s;
  }

  .copy:hover {
    border-color: var(--_accent);
    color: var(--_accent);
  }

  .copy:active {
    transform: translateY(1px);
  }

  .copy:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 1px;
  }

  .copy.copied {
    border-color: color-mix(in srgb, var(--_accent) 40%, transparent);
    background: color-mix(in srgb, var(--_accent) 12%, var(--_bg));
    color: var(--_accent);
  }

  /* the catalog's theme defines the palette; outside it (the component's own catalog file) the code stays plain */
  .comment {
    color: var(--_syntax-comment, inherit);
    font-style: italic;
  }

  .string {
    color: var(--_syntax-string, inherit);
  }

  .tag {
    color: var(--_syntax-tag, inherit);
  }

  .attr {
    color: var(--_syntax-attr, inherit);
  }

  .keyword,
  .op {
    color: var(--_syntax-keyword, inherit);
  }

  .block {
    color: var(--_syntax-block, inherit);
  }

  pre {
    margin: 0;
    padding: 10px;
    border-top: 1px solid var(--_border);
    border-radius: 0 0 6px 6px;
    background: var(--_code-bg);
    overflow-x: auto;
    font-family: var(--_mono);
    font-size: 13px;
    line-height: 1.5;
  }
</style>
