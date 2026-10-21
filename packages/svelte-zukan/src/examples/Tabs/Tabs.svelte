<script lang="ts">
  import type { Snippet } from 'svelte';

  type Item = { id: string; label: string; panel: Snippet };

  let {
    items,
    selected = $bindable(items[0]?.id),
    variant = 'underline'
  }: {
    /** `{ id, label, panel }`, with the panel as a snippet */
    items: Item[];
    /** the `id` of the open tab; bind it with `bind:selected` */
    selected?: string;
    variant?: 'underline' | 'pills';
  } = $props();

  const uid = $props.id();
  const tabs: HTMLButtonElement[] = [];

  function onkeydown(e: KeyboardEvent) {
    const index = items.findIndex((item) => item.id === selected);
    const next =
      e.key === 'ArrowRight'
        ? (index + 1) % items.length
        : e.key === 'ArrowLeft'
          ? (index - 1 + items.length) % items.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? items.length - 1
              : -1;
    if (next === -1) return;
    e.preventDefault();
    selected = items[next].id;
    tabs[next]?.focus();
  }
</script>

<div class={['tabs', variant]}>
  <div class="list" role="tablist" tabindex="-1" {onkeydown}>
    {#each items as item, i (item.id)}
      <button
        bind:this={tabs[i]}
        type="button"
        role="tab"
        id="{uid}-tab-{item.id}"
        aria-controls="{uid}-panel-{item.id}"
        aria-selected={item.id === selected}
        tabindex={item.id === selected ? 0 : -1}
        onclick={() => (selected = item.id)}>{item.label}</button
      >
    {/each}
  </div>
  {#each items as item (item.id)}
    <div
      class="panel"
      role="tabpanel"
      id="{uid}-panel-{item.id}"
      aria-labelledby="{uid}-tab-{item.id}"
      hidden={item.id !== selected}
    >
      {@render item.panel()}
    </div>
  {/each}
</div>

<style>
  .list {
    display: flex;
    gap: 4px;
  }

  .underline .list {
    border-bottom: 1px solid var(--ex-border);
  }

  button {
    position: relative;
    padding: 8px 14px;
    border: 0;
    background: none;
    color: var(--ex-muted);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition:
      color 0.15s,
      background-color 0.15s;
  }

  button:hover {
    color: var(--ex-text);
  }

  button:focus-visible {
    outline: 2px solid var(--ex-accent);
    outline-offset: -2px;
    border-radius: var(--ex-radius-sm);
  }

  .underline button[aria-selected='true'] {
    color: var(--ex-accent);
  }

  .underline button[aria-selected='true']::after {
    content: '';
    position: absolute;
    right: 8px;
    bottom: -1px;
    left: 8px;
    height: 2px;
    border-radius: 2px;
    background: var(--ex-accent);
  }

  .pills .list {
    display: inline-flex;
    padding: 4px;
    border-radius: calc(var(--ex-radius) + 2px);
    background: var(--ex-surface-2);
  }

  .pills button {
    border-radius: var(--ex-radius-sm);
  }

  .pills button[aria-selected='true'] {
    background: var(--ex-surface);
    color: var(--ex-text);
    box-shadow: var(--ex-shadow-sm);
  }

  .panel {
    padding: 16px 2px 4px;
    color: var(--ex-muted);
  }
</style>
