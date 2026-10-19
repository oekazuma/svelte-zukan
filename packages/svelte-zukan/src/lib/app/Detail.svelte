<script lang="ts">
  import Badge from '../components/Badge/Badge.svelte';
  import CodeBlock from '../components/CodeBlock/CodeBlock.svelte';
  import PreviewFrame from '../components/PreviewFrame/PreviewFrame.svelte';
  import type { Entry } from '../types.js';
  import { formatHash } from './hash.js';
  import type { Messages } from './i18n.js';

  let { entry, t }: { entry: Entry; t: Messages } = $props();
</script>

<h1>
  {entry.name}
  {#if entry.dir}<span class="dir">{entry.dir}</span>{/if}
  <Badge label={entry.group} />
</h1>

<!-- recreate everything on navigation so no PreviewFrame keeps the previous entry's width or height -->
{#key entry.path}
  {#await entry.meta() then { default: meta }}
    {#if meta.doc}
      <!-- the HTML comes from the user's own .md file, rendered by the plugin -->
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <div class="doc">{@html meta.doc}</div>
    {/if}
    {#if !meta.sections.length}
      <p class="empty">{t.noSections}</p>
    {/if}
    {#each meta.sections as section (section.title)}
      <h2>{section.title}</h2>
      <PreviewFrame src="./{formatHash('preview', entry.path, section.title)}" title={section.title} labels={t} />
      <CodeBlock code={section.code} labels={t} />
    {/each}
  {:catch error}
    <p>{t.loadFailed} {error instanceof Error ? error.message : String(error)}</p>
  {/await}
{/key}

<style>
  h1 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px;
    font-size: 24px;
  }

  .dir {
    color: var(--_muted);
    font-size: 14px;
    font-weight: normal;
  }

  h2 {
    margin: 24px 0 8px;
    font-size: 18px;
  }

  .doc {
    line-height: 1.6;
  }

  .empty {
    color: var(--_muted);
  }
</style>
