<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import Icon, { type IconName } from '../../Icon/Icon.svelte';

  type Props = Omit<HTMLInputAttributes, 'value'> & {
    /** always visible */
    label: string;
    /** bind it with `bind:value` */
    value?: string;
    /** a line under the field */
    hint?: string;
    /** replaces the hint and marks the field invalid */
    error?: string;
    /** an icon shown inside the field */
    icon?: IconName;
  };

  let { label, value = $bindable(''), hint, error, icon, ...rest }: Props = $props();

  const id = $props.id();
</script>

<div class={['field', { invalid: !!error }]}>
  <label for={id}>{label}</label>
  <div class="control">
    {#if icon}<span class="icon"><Icon name={icon} size={16} /></span>{/if}
    <input
      {...rest}
      {id}
      bind:value
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error || hint ? `${id}-note` : undefined}
    />
  </div>
  {#if error || hint}
    <p class="note" id="{id}-note">{error ?? hint}</p>
  {/if}
</div>

<style>
  .field {
    display: grid;
    gap: 6px;
  }

  label {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .control {
    position: relative;
    display: flex;
    align-items: center;
  }

  .icon {
    position: absolute;
    left: 12px;
    display: flex;
    color: var(--ex-muted);
    pointer-events: none;
  }

  input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--ex-border);
    border-radius: var(--ex-radius);
    background: var(--ex-surface);
    color: var(--ex-text);
    font: inherit;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  .icon + input {
    padding-left: 2.2rem;
  }

  input::placeholder {
    color: var(--ex-muted);
  }

  input:focus {
    border-color: var(--ex-accent);
    outline: none;
    box-shadow: 0 0 0 3px var(--ex-accent-soft);
  }

  input:disabled {
    background: var(--ex-surface-2);
    cursor: not-allowed;
  }

  .note {
    margin: 0;
    color: var(--ex-muted);
    font-size: 0.8125rem;
  }

  .invalid input {
    border-color: var(--ex-danger);
  }

  .invalid input:focus {
    box-shadow: 0 0 0 3px var(--ex-danger-soft);
  }

  .invalid .note {
    color: var(--ex-danger);
  }
</style>
