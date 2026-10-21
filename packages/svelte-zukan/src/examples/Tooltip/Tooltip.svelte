<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    text,
    placement = 'top',
    children
  }: {
    /** a short hint; never put the only label of a control here */
    text: string;
    placement?: 'top' | 'bottom';
    /** the trigger; spread the argument on the focusable element so the hint becomes its description */
    children: Snippet<[{ 'aria-describedby': string }]>;
  } = $props();

  const id = $props.id();
</script>

<span class={['tooltip', placement]}>
  {@render children({ 'aria-describedby': id })}
  <span role="tooltip" {id}>{text}</span>
</span>

<style>
  .tooltip {
    position: relative;
    display: inline-flex;
  }

  [role='tooltip'] {
    position: absolute;
    left: 50%;
    z-index: 1;
    padding: 6px 10px;
    border-radius: var(--ex-radius-sm);
    background: var(--ex-text);
    color: var(--ex-surface);
    font-size: 0.8125rem;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, 4px);
    transition:
      opacity 0.15s,
      transform 0.15s;
  }

  .top [role='tooltip'] {
    bottom: calc(100% + 8px);
  }

  .bottom [role='tooltip'] {
    top: calc(100% + 8px);
    transform: translate(-50%, -4px);
  }

  .tooltip:hover [role='tooltip'],
  .tooltip:focus-within [role='tooltip'] {
    opacity: 1;
    transform: translate(-50%, 0);
  }
</style>
