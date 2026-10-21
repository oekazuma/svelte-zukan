<script lang="ts">
  import type { HTMLSelectAttributes } from 'svelte/elements';

  type Props = Omit<HTMLSelectAttributes, 'value'> & {
    /** 常に表示されるラベル */
    label: string;
    /** 選択肢ごとの `{ value, label }` */
    options: { value: string; label: string }[];
    /** `bind:value` でバインドできる */
    value?: string;
    /** 先頭に置く空の選択肢。何か選ぶまで表示される */
    placeholder?: string;
    /** 入力欄の下に表示する説明 */
    hint?: string;
  };

  let { label, options, value = $bindable(''), placeholder, hint, ...rest }: Props = $props();

  const id = $props.id();
</script>

<div class="field">
  <label for={id}>{label}</label>
  <div class="control">
    <select {...rest} {id} bind:value aria-describedby={hint ? `${id}-hint` : undefined}>
      {#if placeholder}<option value="" disabled>{placeholder}</option>{/if}
      {#each options as option (option.value)}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
    <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  </div>
  {#if hint}<p class="hint" id="{id}-hint">{hint}</p>{/if}
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

  select {
    width: 100%;
    padding: 0.6rem 2.2rem 0.6rem 0.8rem;
    border: 1px solid var(--ex-border);
    border-radius: var(--ex-radius);
    background: var(--ex-surface);
    color: var(--ex-text);
    font: inherit;
    appearance: none;
    cursor: pointer;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  select:focus {
    border-color: var(--ex-accent);
    outline: none;
    box-shadow: 0 0 0 3px var(--ex-accent-soft);
  }

  select:disabled {
    background: var(--ex-surface-2);
    cursor: not-allowed;
  }

  .chevron {
    position: absolute;
    right: 12px;
    color: var(--ex-muted);
    pointer-events: none;
  }

  .hint {
    margin: 0;
    color: var(--ex-muted);
    font-size: 0.8125rem;
  }
</style>
