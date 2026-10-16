<script lang="ts">
  import type { Entry } from '../types.js';
  import Badge from './Badge/Badge.svelte';
  import CodeBlock from './CodeBlock/CodeBlock.svelte';
  import PreviewFrame from './PreviewFrame/PreviewFrame.svelte';

  let { entry, base }: { entry: Entry; base: string } = $props();

  // names may contain '#', '?' or '%', so encode each segment
  const previewSrc = (title: string) =>
    `${base}/preview/${entry.path.split('/').map(encodeURIComponent).join('/')}?section=${encodeURIComponent(title)}`;
</script>

<h1>{entry.name} <Badge label={entry.group} /></h1>

{#key entry.path}
  {#await entry.load() then mod}
    {@const meta = mod.__zukan}
    {#if !meta}
      <p>Vite プラグイン <code>zukan()</code> が登録されていません</p>
    {:else}
      {#if meta.doc}
        <!-- the HTML comes from the user's own Document.md, rendered at build time -->
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <div class="doc">{@html meta.doc}</div>
      {/if}
      {#each meta.sections as section (section.title)}
        <h2>{section.title}</h2>
        <PreviewFrame src={previewSrc(section.title)} title={section.title} />
        <CodeBlock code={section.code} />
      {/each}
    {/if}
  {:catch error}
    <p>読み込めませんでした: {error instanceof Error ? error.message : String(error)}</p>
  {/await}
{/key}

<style>
  h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px;
    font-size: 24px;
  }

  h2 {
    margin: 24px 0 8px;
    font-size: 18px;
  }

  .doc {
    line-height: 1.6;
  }
</style>
