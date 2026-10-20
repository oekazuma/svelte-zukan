<script lang="ts">
  import Badge from '../components/Badge/Badge.svelte';
  import CodeBlock from '../components/CodeBlock/CodeBlock.svelte';
  import PreviewFrame from '../components/PreviewFrame/PreviewFrame.svelte';
  import type { Theme } from '../components/PreviewFrame/storage.js';
  import type { Entry } from '../types.js';
  import { formatHash } from './hash.js';
  import type { Messages } from './i18n.js';

  let {
    entry,
    section = null,
    theme,
    t
  }: { entry: Entry; section?: string | null; theme: Theme; t: Messages } = $props();

  // the detail page is not remounted when only the section changes, so the action also runs on update
  function reveal(node: HTMLElement, active: boolean) {
    if (active) node.scrollIntoView();
    return { update: (next: boolean) => next && node.scrollIntoView() };
  }
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
    {#each meta.sections as s (s.title)}
      <!-- a hash route of this catalog, not a SvelteKit route -->
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <h2 use:reveal={section === s.title}><a href={formatHash('detail', entry.path, s.title)}>{s.title}</a></h2>
      <!-- the page's own path: "./" drops index.html, and the query is not part of the catalog -->
      <PreviewFrame
        src={location.pathname + formatHash('preview', entry.path, s.title)}
        title={s.title}
        {theme}
        labels={t}
      />
      <CodeBlock code={s.code} labels={t} />
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

  h2 a {
    color: inherit;
    text-decoration: none;
  }

  h2 a:hover,
  h2 a:focus-visible {
    text-decoration: underline;
  }

  .doc {
    line-height: 1.6;
  }

  .empty {
    color: var(--_muted);
  }
</style>
