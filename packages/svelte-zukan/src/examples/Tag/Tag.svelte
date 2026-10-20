<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../Icon/Icon.svelte';

  let {
    tone = 'neutral',
    children,
    onremove
  }: {
    tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
    children: Snippet;
    /** shows a remove button */
    onremove?: () => void;
  } = $props();
</script>

<span class={['tag', tone]}>
  <span class="dot" aria-hidden="true"></span>
  {@render children()}
  {#if onremove}
    <button type="button" aria-label="Remove" onclick={onremove}><Icon name="x" size={12} /></button>
  {/if}
</span>

<style>
  .tag {
    --tone: var(--ex-muted);
    --tone-soft: var(--ex-surface-2);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--tone-soft);
    color: var(--ex-text);
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1.4;
  }

  .accent {
    --tone: var(--ex-accent);
    --tone-soft: var(--ex-accent-soft);
  }

  .success {
    --tone: var(--ex-success);
    --tone-soft: var(--ex-success-soft);
  }

  .warning {
    --tone: var(--ex-warning);
    --tone-soft: var(--ex-warning-soft);
  }

  .danger {
    --tone: var(--ex-danger);
    --tone-soft: var(--ex-danger-soft);
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--tone);
  }

  button {
    display: inline-grid;
    place-items: center;
    margin: 0 -4px 0 0;
    padding: 2px;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--ex-muted);
    cursor: pointer;
  }

  button:hover {
    background: var(--ex-border);
    color: var(--ex-text);
  }
</style>
