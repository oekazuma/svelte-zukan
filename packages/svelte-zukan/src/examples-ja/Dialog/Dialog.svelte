<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../Icon/Icon.svelte';

  let {
    open = $bindable(false),
    title,
    children,
    actions
  }: {
    /** `bind:open` でバインドできる。Escape キーと閉じるボタンで `false` に戻る */
    open?: boolean;
    title: string;
    children?: Snippet;
    /** 右下に並べるボタン */
    actions?: Snippet;
  } = $props();

  const id = $props.id();
  let dialog: HTMLDialogElement;

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="{id}-title"
  onclose={() => (open = false)}
  onclick={(e) => e.target === dialog && dialog.close()}
>
  <header>
    <h2 id="{id}-title">{title}</h2>
    <button type="button" class="close" aria-label="閉じる" onclick={() => dialog.close()}>
      <Icon name="x" size={18} />
    </button>
  </header>
  {#if children}<div class="body">{@render children()}</div>{/if}
  {#if actions}<footer>{@render actions()}</footer>{/if}
</dialog>

<style>
  dialog {
    width: min(440px, calc(100vw - 32px));
    padding: 0;
    border: 1px solid var(--ex-border);
    border-radius: calc(var(--ex-radius) + 4px);
    background: var(--ex-surface);
    color: var(--ex-text);
    box-shadow: var(--ex-shadow);
  }

  dialog::backdrop {
    background: rgb(20 18 32 / 0.45);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 20px 0;
  }

  h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  .close {
    display: inline-grid;
    place-items: center;
    padding: 4px;
    border: 0;
    border-radius: var(--ex-radius-sm);
    background: none;
    color: var(--ex-muted);
    cursor: pointer;
  }

  .close:hover {
    background: var(--ex-surface-2);
    color: var(--ex-text);
  }

  .body {
    padding: 8px 20px 0;
    color: var(--ex-muted);
  }

  .body:last-child {
    padding-bottom: 20px;
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 20px;
  }
</style>
