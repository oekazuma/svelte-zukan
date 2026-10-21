<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../Icon/Icon.svelte';

  let {
    title,
    open = $bindable(false),
    name,
    children
  }: {
    /** the always-visible line */
    title: string;
    /** bind it with `bind:open` */
    open?: boolean;
    /** items with the same `name` close each other, so only one is open at a time */
    name?: string;
    children: Snippet;
  } = $props();
</script>

<details class="accordion" {name} bind:open>
  <summary>
    <span>{title}</span>
    <span class="chevron"><Icon name="arrow-right" size={16} /></span>
  </summary>
  <div class="body">{@render children()}</div>
</details>

<style>
  .accordion {
    border-bottom: 1px solid var(--ex-border);
  }

  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 4px;
    font-weight: 600;
    list-style: none;
    cursor: pointer;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary:hover {
    color: var(--ex-accent);
  }

  summary:focus-visible {
    outline: 2px solid var(--ex-accent);
    outline-offset: 2px;
    border-radius: var(--ex-radius-sm);
  }

  .chevron {
    display: flex;
    color: var(--ex-muted);
    transition: transform 0.2s;
  }

  [open] .chevron {
    transform: rotate(90deg);
  }

  .body {
    padding: 0 4px 16px;
    color: var(--ex-muted);
  }
</style>
