<script lang="ts">
  let { code }: { code: string } = $props();

  let copied = $state(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      copied = true;
    } catch {
      // clipboard unavailable (insecure context, denied): leave the label unchanged
    }
  }

  $effect(() => {
    if (!copied) return;
    const timer = setTimeout(() => (copied = false), 2000);
    return () => clearTimeout(timer);
  });
</script>

<details>
  <summary>コード</summary>
  <div class="body">
    <button type="button" onclick={copy} aria-live="polite">{copied ? 'コピーしました' : 'コピー'}</button>
    <pre><code>{code}</code></pre>
  </div>
</details>

<style>
  details {
    border: 1px solid var(--_border);
    border-radius: 6px;
    font-family: var(--_font);
    color: var(--_text);
  }

  summary {
    padding: 6px 10px;
    font-size: 13px;
    color: var(--_muted);
    cursor: pointer;
  }

  .body {
    position: relative;
    border-top: 1px solid var(--_border);
    background: var(--_code-bg);
  }

  button {
    position: absolute;
    top: 6px;
    right: 6px;
    padding: 2px 8px;
    border: 1px solid var(--_border);
    border-radius: 4px;
    background: var(--_bg);
    color: var(--_text);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  pre {
    margin: 0;
    padding: 10px;
    overflow-x: auto;
    font-family: var(--_mono);
    font-size: 13px;
    line-height: 1.5;
  }
</style>
