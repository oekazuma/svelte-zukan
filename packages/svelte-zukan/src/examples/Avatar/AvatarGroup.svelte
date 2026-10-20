<script lang="ts">
  import Avatar from './Avatar.svelte';

  let { names, max = 4 }: { names: string[]; max?: number } = $props();

  const shown = $derived(names.slice(0, max));
  const rest = $derived(names.length - shown.length);
</script>

<div class="group">
  {#each shown as name (name)}
    <Avatar {name} size="sm" />
  {/each}
  {#if rest > 0}
    <span class="more" aria-label="{rest} more">+{rest}</span>
  {/if}
</div>

<style>
  .group {
    display: inline-flex;
    align-items: center;
  }

  .group > :global(*:not(:first-child)) {
    margin-left: -8px;
  }

  .more {
    display: inline-grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--ex-surface-2);
    color: var(--ex-muted);
    font-size: 11px;
    font-weight: 600;
    box-shadow: 0 0 0 2px var(--ex-surface);
  }
</style>
