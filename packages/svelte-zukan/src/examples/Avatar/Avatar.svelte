<script lang="ts">
  let {
    name,
    src,
    size = 'md',
    status
  }: {
    name: string;
    /** an image URL; without one the initials are shown */
    src?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    status?: 'online' | 'away' | 'offline';
  } = $props();

  const initials = $derived(
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('')
  );
  // the same name always gets the same color
  const hue = $derived([...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7));
</script>

<span class={['avatar', size]} style:--hue={hue} title={name}>
  {#if src}
    <img {src} alt={name} />
  {:else}
    <span aria-hidden="true">{initials}</span>
    <span class="sr-only">{name}</span>
  {/if}
  {#if status}
    <span class={['status', status]} aria-label={status}></span>
  {/if}
</span>

<style>
  .avatar {
    position: relative;
    display: inline-grid;
    place-items: center;
    flex: none;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    background: linear-gradient(135deg, hsl(var(--hue) 75% 62%), hsl(calc(var(--hue) + 40) 70% 48%));
    color: #fff;
    font-size: calc(var(--size) * 0.4);
    font-weight: 600;
    letter-spacing: 0.02em;
    box-shadow: 0 0 0 2px var(--ex-surface);
  }

  .sm {
    --size: 28px;
  }

  .md {
    --size: 40px;
  }

  .lg {
    --size: 56px;
  }

  .xl {
    --size: 80px;
  }

  img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .status {
    position: absolute;
    right: 0;
    bottom: 0;
    width: max(8px, calc(var(--size) * 0.26));
    height: max(8px, calc(var(--size) * 0.26));
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--ex-surface);
  }

  .online {
    background: var(--ex-success);
  }

  .away {
    background: var(--ex-warning);
  }

  .offline {
    background: var(--ex-muted);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
