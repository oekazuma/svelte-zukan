<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Props = HTMLButtonAttributes & {
    /** `primary` for the main action of a screen, `ghost` for low-emphasis actions, `danger` for destructive ones */
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    /** shows a spinner and blocks clicks until the work is done */
    loading?: boolean;
    /** rendered before the label */
    icon?: Snippet;
  };

  let {
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon,
    /** the label */
    children,
    /** blocks clicks, as `loading` does */
    disabled,
    /** added to the button's own classes */
    class: className,
    ...rest
  }: Props = $props();
</script>

<button
  {...rest}
  class={['button', variant, size, className]}
  disabled={disabled || loading}
  aria-busy={loading || undefined}
>
  {#if loading}
    <span class="spinner" aria-hidden="true"></span>
  {:else if icon}
    {@render icon()}
  {/if}
  {@render children?.()}
</button>

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    border: 1px solid transparent;
    border-radius: var(--ex-radius);
    font: inherit;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color 0.15s,
      border-color 0.15s,
      box-shadow 0.15s,
      transform 0.05s;
  }

  .button:active:not(:disabled) {
    transform: translateY(1px);
  }

  .button:focus-visible {
    outline: 2px solid var(--ex-accent);
    outline-offset: 2px;
  }

  .button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sm {
    padding: 0.35rem 0.7rem;
    font-size: 0.8125rem;
  }

  .md {
    padding: 0.55rem 1rem;
    font-size: 0.9rem;
  }

  .lg {
    padding: 0.75rem 1.35rem;
    font-size: 1rem;
  }

  .primary {
    background: var(--ex-accent);
    color: var(--ex-on-accent);
    box-shadow: var(--ex-shadow-sm);
  }

  .primary:hover:not(:disabled) {
    background: var(--ex-accent-strong);
  }

  .secondary {
    border-color: var(--ex-border);
    background: var(--ex-surface);
    color: var(--ex-text);
    box-shadow: var(--ex-shadow-sm);
  }

  .secondary:hover:not(:disabled) {
    background: var(--ex-surface-2);
  }

  .ghost {
    background: transparent;
    color: var(--ex-accent);
  }

  .ghost:hover:not(:disabled) {
    background: var(--ex-accent-soft);
  }

  .danger {
    background: var(--ex-danger);
    color: var(--ex-on-accent);
  }

  .danger:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  .spinner {
    width: 1em;
    height: 1em;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 2s;
    }
  }
</style>
