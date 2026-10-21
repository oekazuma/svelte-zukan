<script lang="ts">
  let {
    shape = 'text',
    width,
    height,
    lines = 1
  }: {
    /** `text` is one line tall; `circle` uses `width` for both sides */
    shape?: 'text' | 'rect' | 'circle';
    /** any CSS length; defaults to the full width (`text`, `rect`) or 40px (`circle`) */
    width?: string;
    /** any CSS length, for `rect` */
    height?: string;
    /** for `text`: the last line is shorter */
    lines?: number;
  } = $props();

  const count = $derived(shape === 'text' ? Math.max(1, lines) : 1);
</script>

<span class="skeleton" aria-hidden="true">
  {#each { length: count }, i (i)}
    <span
      class={['bone', shape, { last: count > 1 && i === count - 1 }]}
      style:width={shape === 'circle' ? (width ?? '40px') : width}
      style:height={shape === 'circle' ? (width ?? '40px') : height}
    ></span>
  {/each}
</span>

<style>
  .skeleton {
    display: grid;
    gap: 8px;
  }

  .bone {
    display: block;
    border-radius: var(--ex-radius-sm);
    background: linear-gradient(90deg, var(--ex-surface-2) 25%, var(--ex-border) 50%, var(--ex-surface-2) 75%) 0 0 /
      200% 100%;
    animation: shimmer 1.4s ease-in-out infinite;
  }

  .text {
    height: 0.9em;
  }

  .rect {
    height: 120px;
  }

  .circle {
    border-radius: 50%;
  }

  .last {
    width: 60%;
  }

  @keyframes shimmer {
    from {
      background-position: 100% 0;
    }
    to {
      background-position: -100% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bone {
      animation: none;
    }
  }
</style>
