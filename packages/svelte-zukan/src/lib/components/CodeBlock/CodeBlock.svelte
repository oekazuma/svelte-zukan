<script lang="ts">
  import { messages, type Messages } from '../../app/i18n.js';

  let {
    code,
    labels = messages.en
  }: { code: string; labels?: Pick<Messages, 'code' | 'copy' | 'copied' | 'copyFailed'> } = $props();

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
</script>

<!-- the button sits on the summary row but outside <summary>, which must not contain interactive content -->
<div class="code-block">
  <details>
    <summary>{labels.code}</summary>
    <pre><code>{code}</code></pre>
  </details>
  <button type="button" onclick={copy} aria-live="polite">
    {status === 'copied' ? labels.copied : status === 'failed' ? labels.copyFailed : labels.copy}
  </button>
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
    padding: 6px 160px 6px 10px;
    font-size: 13px;
    line-height: 20px;
    color: var(--_muted);
    cursor: pointer;
  }

  button {
    position: absolute;
    top: 5px;
    right: 6px;
    padding: 0 8px;
    border: 1px solid var(--_border);
    border-radius: 4px;
    background: var(--_bg);
    color: var(--_text);
    font: inherit;
    font-size: 12px;
    line-height: 20px;
    cursor: pointer;
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
