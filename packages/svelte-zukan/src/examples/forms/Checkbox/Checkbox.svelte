<script lang="ts">
  import Icon from '../../Icon/Icon.svelte';

  let {
    checked = $bindable(false),
    indeterminate = $bindable(false),
    label,
    description,
    disabled = false
  }: {
    /** bind it with `bind:checked` */
    checked?: boolean;
    /** a "some of them" state, for a box that controls a group; clicking clears it */
    indeterminate?: boolean;
    label: string;
    /** a line under the label */
    description?: string;
    disabled?: boolean;
  } = $props();
</script>

<label class={['checkbox', { disabled }]}>
  <input type="checkbox" bind:checked bind:indeterminate {disabled} />
  <span class="box" aria-hidden="true">
    {#if indeterminate}<span class="dash"></span>{:else if checked}<Icon name="check" size={14} />{/if}
  </span>
  <span class="text">
    <span class="label">{label}</span>
    {#if description}<span class="description">{description}</span>{/if}
  </span>
</label>

<style>
  .checkbox {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
  }

  .disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .box {
    flex: none;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    margin-top: 2px;
    border: 1.5px solid var(--ex-border);
    border-radius: 5px;
    background: var(--ex-surface);
    color: var(--ex-on-accent);
    transition:
      background-color 0.15s,
      border-color 0.15s;
  }

  input:checked + .box,
  input:indeterminate + .box {
    border-color: var(--ex-accent);
    background: var(--ex-accent);
  }

  input:focus-visible + .box {
    outline: 2px solid var(--ex-accent);
    outline-offset: 2px;
  }

  .dash {
    width: 8px;
    height: 2px;
    border-radius: 1px;
    background: currentColor;
  }

  .text {
    display: grid;
  }

  .label {
    font-weight: 500;
  }

  .description {
    color: var(--ex-muted);
    font-size: 0.85rem;
  }
</style>
