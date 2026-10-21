<script lang="ts">
  let {
    checked = $bindable(false),
    label,
    description,
    disabled = false
  }: {
    /** `bind:checked` でバインドできる */
    checked?: boolean;
    /** 設定項目の名前 */
    label: string;
    /** 設定の内容を説明する 1 行 */
    description?: string;
    disabled?: boolean;
  } = $props();
</script>

<label class={['switch', { disabled }]}>
  <input type="checkbox" role="switch" bind:checked {disabled} />
  <span class="track" aria-hidden="true"><span class="thumb"></span></span>
  <span class="text">
    <span class="label">{label}</span>
    {#if description}<span class="description">{description}</span>{/if}
  </span>
</label>

<style>
  .switch {
    display: flex;
    align-items: flex-start;
    gap: 12px;
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

  .track {
    flex: none;
    position: relative;
    width: 40px;
    height: 24px;
    border-radius: 999px;
    background: var(--ex-border);
    transition: background-color 0.2s;
  }

  .thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
    transition: transform 0.2s;
  }

  input:checked + .track {
    background: var(--ex-accent);
  }

  input:checked + .track .thumb {
    transform: translateX(16px);
  }

  input:focus-visible + .track {
    outline: 2px solid var(--ex-accent);
    outline-offset: 2px;
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
