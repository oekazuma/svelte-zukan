<script lang="ts">
  let {
    items,
    label = 'パンくずリスト'
  }: {
    /** 最上位から順に並べる。最後の項目は現在のページで、リンクにならない */
    items: { label: string; href?: string }[];
    /** `<nav>` のアクセシブルな名前 */
    label?: string;
  } = $props();
</script>

<nav aria-label={label}>
  <ol>
    {#each items as item, i (i)}
      <li>
        {#if i === items.length - 1}
          <span aria-current="page">{item.label}</span>
        {:else}
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes resolved hrefs -->
          <a href={item.href}>{item.label}</a>
        {/if}
      </li>
    {/each}
  </ol>
</nav>

<style>
  ol {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    margin: 0;
    padding: 0;
    font-size: 0.9rem;
    list-style: none;
  }

  li + li::before {
    content: '/';
    margin: 0 8px;
    color: var(--ex-border);
  }

  a {
    border-radius: 4px;
    color: var(--ex-muted);
    text-decoration: none;
  }

  a:hover {
    color: var(--ex-accent);
    text-decoration: underline;
  }

  a:focus-visible {
    outline: 2px solid var(--ex-accent);
    outline-offset: 2px;
  }

  [aria-current] {
    color: var(--ex-text);
    font-weight: 600;
  }
</style>
