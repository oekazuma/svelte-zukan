<script lang="ts">
  import { page } from '$app/state';
  import { buildEntries, resolveBase } from './entries.js';
  import type { Groups } from './types.js';
  import Detail from './components/Detail.svelte';
  import EntryList from './components/EntryList.svelte';
  import Preview from './components/Preview.svelte';

  let { groups }: { groups: Groups } = $props();

  const entries = $derived(buildEntries(groups));
  // the library has no routes of its own, so page.params is typed {}; the app's [...path] route supplies it
  const path = $derived((page.params as { path?: string }).path ?? '');
  const base = $derived(resolveBase(page.url.pathname, path));
  const isPreview = $derived(path.startsWith('preview/'));
  const entry = $derived(entries.find((e) => e.path === (isPreview ? path.slice('preview/'.length) : path)));
</script>

{#if isPreview}
  {#if entry}
    <Preview {entry} />
  {:else}
    <p>見つかりません</p>
  {/if}
{:else}
  <div class="zukan">
    <aside><EntryList {entries} {base} current={entry?.path} /></aside>
    <main>
      {#if path === ''}
        <EntryList {entries} {base} />
      {:else if entry}
        <Detail {entry} {base} />
      {:else}
        <p>見つかりません</p>
      {/if}
    </main>
  </div>
{/if}

<style>
  .zukan {
    --_bg: var(--zukan-color-bg, #fff);
    --_text: var(--zukan-color-text, #1f2328);
    --_muted: var(--zukan-color-muted, #59636e);
    --_border: var(--zukan-color-border, #d1d9e0);
    --_accent: var(--zukan-color-accent, #0969da);
    --_code-bg: var(--zukan-color-code-bg, #f6f8fa);
    --_font: var(--zukan-font-family, system-ui, sans-serif);
    --_mono: var(--zukan-font-mono, ui-monospace, monospace);
    --_sidebar-width: var(--zukan-sidebar-width, 240px);

    display: grid;
    grid-template-columns: var(--_sidebar-width) minmax(0, 1fr);
    min-height: 100vh;
    background: var(--_bg);
    color: var(--_text);
    font-family: var(--_font);
  }

  aside {
    padding: 16px 8px;
    border-right: 1px solid var(--_border);
  }

  main {
    padding: 24px;
  }
</style>
