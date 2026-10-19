<script lang="ts">
  import { tick, type Component, type Snippet } from 'svelte';
  import type { Entry } from '../types.js';
  import Detail from './Detail.svelte';
  import { parseHash } from './hash.js';
  import { messages } from './i18n.js';
  import List from './List.svelte';
  import Preview from './Preview.svelte';
  import Sidebar from './Sidebar.svelte';

  let {
    catalog,
    logo,
    wrapper,
    title,
    locale,
    searched
  }: {
    catalog: Entry[];
    logo: string | null;
    wrapper: (() => Promise<{ default: Component<{ children: Snippet }> }>) | null;
    title: string;
    locale: 'en' | 'ja';
    searched: { group: string; dirs: string[] }[];
  } = $props();

  let hash = $state(location.hash);

  const t = $derived(messages[locale]);
  const route = $derived(parseHash(hash));
  const entry = $derived(route.view === 'list' ? undefined : catalog.find((e) => e.path === route.path));

  // components in a preview and links in a doc can change the hash too; only catalog routes navigate
  function onhashchange() {
    const next = location.hash;
    if (next !== '' && !next.startsWith('#/')) return;
    if (route.view === 'preview' && parseHash(next).view !== 'preview') return;
    hash = next;
    // the browser keeps the scroll position on a hash change; the previous page's position means nothing on the next
    if (route.view !== 'preview') tick().then(() => scrollTo(0, 0));
  }
</script>

<svelte:window {onhashchange} />

<svelte:head>
  <title>{route.view === 'detail' && entry ? `${entry.name} | ${title}` : title}</title>
</svelte:head>

{#if route.view === 'preview'}
  {#if entry}
    {#key hash}
      <Preview {entry} section={route.section} {wrapper} {t} />
    {/key}
  {:else}
    <p>{t.notFound}</p>
  {/if}
{:else}
  <div class="zukan">
    <Sidebar entries={catalog} current={entry?.path} {logo} {title} {t} />
    <main>
      {#if route.view === 'list'}
        <List entries={catalog} {searched} {t} />
      {:else if entry}
        <Detail {entry} {t} />
      {:else}
        <h1>{t.notFound}</h1>
      {/if}
    </main>
  </div>
{/if}

<style>
  /* the catalog is its own page; the preview's height is measured from its content, so no body margin either */
  :global(body) {
    margin: 0;
  }

  /* the catalog UI follows the system theme; the preview page (no .zukan) is left to the app's own CSS */
  :global(html:has(> body > .zukan)) {
    color-scheme: light dark;
  }

  /* internal theme; the catalog page loads no app CSS, so these are not meant to be overridden */
  .zukan {
    --_bg: #fff;
    --_text: #1f2328;
    --_muted: #59636e;
    --_border: #d1d9e0;
    --_accent: #0969da;
    --_code-bg: #f6f8fa;
    --_font: system-ui, sans-serif;
    --_mono: ui-monospace, monospace;
    --_sidebar-width: 240px;

    display: grid;
    grid-template-columns: var(--_sidebar-width) minmax(0, 1fr);
    min-height: 100vh;
    background: var(--_bg);
    color: var(--_text);
    font-family: var(--_font);
  }

  @media (prefers-color-scheme: dark) {
    .zukan {
      --_bg: #0d1117;
      --_text: #f0f6fc;
      --_muted: #9198a1;
      --_border: #3d444d;
      --_accent: #4493f8;
      --_code-bg: #151b23;
    }
  }

  main {
    padding: 24px;
  }

  @media (max-width: 767px) {
    .zukan {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto 1fr;
    }

    main {
      padding: 16px;
    }
  }

  h1 {
    margin: 0 0 16px;
    font-size: 24px;
  }
</style>
