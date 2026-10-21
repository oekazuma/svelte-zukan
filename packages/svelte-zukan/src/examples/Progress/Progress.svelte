<script lang="ts">
  let {
    value,
    max = 100,
    label,
    tone = 'accent'
  }: {
    /** leave it out for an indeterminate bar */
    value?: number;
    max?: number;
    /** shown above the bar and used as its accessible name */
    label: string;
    tone?: 'accent' | 'success' | 'warning' | 'danger';
  } = $props();

  const percent = $derived(value === undefined ? null : Math.round((Math.min(Math.max(value, 0), max) / max) * 100));
</script>

<div class="progress">
  <div class="head">
    <span>{label}</span>
    {#if percent !== null}<span class="value">{percent}%</span>{/if}
  </div>
  <div
    class={['track', tone, { indeterminate: percent === null }]}
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={max}
    aria-valuenow={value}
  >
    <div class="bar" style:width={percent === null ? undefined : `${percent}%`}></div>
  </div>
</div>

<style>
  .progress {
    display: grid;
    gap: 6px;
  }

  .head {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .value {
    color: var(--ex-muted);
    font-variant-numeric: tabular-nums;
  }

  .track {
    --tone: var(--ex-accent);
    position: relative;
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--ex-surface-2);
  }

  .success {
    --tone: var(--ex-success);
  }

  .warning {
    --tone: var(--ex-warning);
  }

  .danger {
    --tone: var(--ex-danger);
  }

  .bar {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, color-mix(in srgb, var(--tone) 70%, white), var(--tone));
    transition: width 0.3s ease;
  }

  .indeterminate .bar {
    position: absolute;
    width: 40%;
    animation: slide 1.2s ease-in-out infinite;
  }

  @keyframes slide {
    from {
      left: -40%;
    }

    to {
      left: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .indeterminate .bar {
      animation-duration: 3s;
    }
  }
</style>
