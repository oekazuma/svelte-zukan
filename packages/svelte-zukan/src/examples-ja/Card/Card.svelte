<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    eyebrow,
    cover,
    horizontal = false,
    children,
    footer
  }: {
    /** カードの見出し */
    title: string;
    /** タイトルの上に置く小さなテキスト */
    eyebrow?: string;
    /** カバー領域の CSS の背景。グラデーションや `url(...)` など */
    cover?: string;
    /** カードの幅が 520px を超えると、カバーを本文の横に並べる（コンテナクエリなので、ウィンドウではなくカード自身の幅で決まる） */
    horizontal?: boolean;
    children?: Snippet;
    /** 価格、タグ、ボタンなど */
    footer?: Snippet;
  } = $props();
</script>

<div class="container">
  <article class={['card', { horizontal }]}>
    {#if cover}
      <div class="cover" style:background={cover}></div>
    {/if}
    <div class="content">
      {#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
      <h3>{title}</h3>
      {#if children}<div class="body">{@render children()}</div>{/if}
      {#if footer}<footer>{@render footer()}</footer>{/if}
    </div>
  </article>
</div>

<style>
  .container {
    container-type: inline-size;
  }

  .card {
    display: grid;
    overflow: hidden;
    border: 1px solid var(--ex-border);
    border-radius: calc(var(--ex-radius) + 4px);
    background: var(--ex-surface);
    box-shadow: var(--ex-shadow);
  }

  .cover {
    min-height: 140px;
  }

  @container (min-width: 520px) {
    .horizontal {
      grid-template-columns: minmax(180px, 2fr) 3fr;
    }

    .horizontal .cover {
      min-height: 100%;
    }
  }

  .content {
    display: grid;
    gap: 8px;
    padding: 18px 20px 20px;
  }

  .eyebrow {
    margin: 0;
    color: var(--ex-accent);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h3 {
    margin: 0;
    font-size: 1.15rem;
    line-height: 1.3;
  }

  .body {
    color: var(--ex-muted);
    font-size: 0.9rem;
  }

  .body > :global(p) {
    margin: 0;
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }
</style>
