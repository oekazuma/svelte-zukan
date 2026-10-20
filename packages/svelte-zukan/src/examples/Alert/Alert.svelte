<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon, { type IconName } from '../Icon/Icon.svelte';

  type Tone = 'info' | 'success' | 'warning' | 'danger';

  let {
    tone = 'info',
    title,
    children,
    actions,
    ondismiss
  }: {
    tone?: Tone;
    title?: string;
    children?: Snippet;
    actions?: Snippet;
    /** shows a close button */
    ondismiss?: () => void;
  } = $props();

  const icons: Record<Tone, IconName> = { info: 'info', success: 'success', warning: 'warning', danger: 'error' };
</script>

<div class={['alert', tone]} role={tone === 'danger' ? 'alert' : 'status'}>
  <span class="icon"><Icon name={icons[tone]} size={20} /></span>
  <div class="text">
    {#if title}<strong>{title}</strong>{/if}
    {#if children}<div>{@render children()}</div>{/if}
    {#if actions}<div class="actions">{@render actions()}</div>{/if}
  </div>
  {#if ondismiss}
    <button type="button" class="close" aria-label="Dismiss" onclick={ondismiss}><Icon name="x" size={16} /></button>
  {/if}
</div>

<style>
  .alert {
    --tone: var(--ex-info);
    --tone-soft: var(--ex-info-soft);
    display: flex;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid color-mix(in srgb, var(--tone) 30%, transparent);
    border-radius: var(--ex-radius);
    background: var(--tone-soft);
    color: var(--ex-text);
    font-size: 0.9rem;
  }

  .success {
    --tone: var(--ex-success);
    --tone-soft: var(--ex-success-soft);
  }

  .warning {
    --tone: var(--ex-warning);
    --tone-soft: var(--ex-warning-soft);
  }

  .danger {
    --tone: var(--ex-danger);
    --tone-soft: var(--ex-danger-soft);
  }

  .icon {
    display: flex;
    color: var(--tone);
  }

  .text {
    display: grid;
    flex: 1;
    gap: 2px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }

  .close {
    align-self: flex-start;
    display: inline-grid;
    place-items: center;
    padding: 4px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--ex-muted);
    cursor: pointer;
  }

  .close:hover {
    background: color-mix(in srgb, var(--tone) 15%, transparent);
    color: var(--ex-text);
  }
</style>
