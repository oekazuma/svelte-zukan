<script lang="ts">
  import Icon from '../../Icon/Icon.svelte';

  let {
    page = $bindable(1),
    count,
    siblings = 1
  }: {
    /** 現在のページ（1 から）。`bind:page` でバインドできる */
    page?: number;
    /** ページ数 */
    count: number;
    /** 現在のページの両側に表示するページ数 */
    siblings?: number;
  } = $props();

  const pages = $derived.by(() => {
    const result: (number | '…')[] = [];
    for (let n = 1; n <= count; n++) {
      const near = Math.abs(n - page) <= siblings;
      // an ellipsis in place of a single page saves no room
      const lone = Math.abs(n - page) === siblings + 1 && (n === 2 || n === count - 1);
      if (n === 1 || n === count || near || lone) result.push(n);
      else if (result.at(-1) !== '…') result.push('…');
    }
    return result;
  });
</script>

<nav aria-label="ページネーション">
  <button type="button" aria-label="前のページ" disabled={page <= 1} onclick={() => page--}>
    <Icon name="arrow-left" size={16} />
  </button>
  {#each pages as n, i (n === '…' ? `gap-${i}` : n)}
    {#if n === '…'}
      <span class="gap" aria-hidden="true">…</span>
    {:else}
      <button
        type="button"
        aria-label="{n} ページ目"
        aria-current={n === page ? 'page' : undefined}
        onclick={() => (page = n)}>{n}</button
      >
    {/if}
  {/each}
  <button type="button" aria-label="次のページ" disabled={page >= count} onclick={() => page++}>
    <Icon name="arrow-right" size={16} />
  </button>
</nav>

<style>
  nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  button {
    display: inline-grid;
    place-items: center;
    min-width: 36px;
    height: 36px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: var(--ex-radius-sm);
    background: none;
    color: var(--ex-text);
    font: inherit;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    background: var(--ex-surface-2);
  }

  button:focus-visible {
    outline: 2px solid var(--ex-accent);
    outline-offset: 1px;
  }

  button:disabled {
    color: var(--ex-muted);
    opacity: 0.5;
    cursor: not-allowed;
  }

  [aria-current] {
    border-color: var(--ex-accent);
    background: var(--ex-accent-soft);
    color: var(--ex-accent-strong);
    font-weight: 600;
  }

  .gap {
    min-width: 24px;
    color: var(--ex-muted);
    text-align: center;
  }
</style>
