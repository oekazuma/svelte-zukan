<script lang="ts">
  import { tick, type Component, type Snippet } from 'svelte';
  import { readTheme, writeTheme, type Theme } from '../components/PreviewFrame/storage.js';
  import type { Entry } from '../types.js';
  import Detail from './Detail.svelte';
  import { formatHash, parseHash } from './hash.js';
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

  // an ignored hash stays in the URL; the history entry keeps the catalog route so a reload can return to it
  const KEY = 'zukanHash';
  const remembered = () => {
    const state = history.state as Record<string, unknown> | null;
    return typeof state?.[KEY] === 'string' ? (state[KEY] as string) : null;
  };

  let hash = $state(remembered() ?? location.hash);

  let theme = $state<Theme>(readTheme() ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    writeTheme(theme);
  }

  const t = $derived(messages[locale]);
  const route = $derived(parseHash(hash));
  const entry = $derived(route.view === 'list' ? undefined : catalog.find((e) => e.path === route.path));
  const index = $derived(entry ? catalog.indexOf(entry) : -1);
  const previous = $derived(index > 0 ? catalog[index - 1] : undefined);
  const next = $derived(index === -1 ? (route.view === 'list' ? catalog[0] : undefined) : catalog[index + 1]);

  let shortcuts: HTMLDialogElement | undefined = $state();

  function onkeydown(e: KeyboardEvent) {
    if (route.view === 'preview' || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (e.key === '?') {
      e.preventDefault();
      shortcuts?.showModal();
      return;
    }
    const to = e.key === 'j' ? next : e.key === 'k' ? previous : undefined;
    if (!to) return;
    e.preventDefault();
    location.hash = formatHash('detail', to.path);
  }

  // components in a preview and links in a doc can change the hash too; only catalog routes navigate
  function onhashchange() {
    const next = location.hash;
    const foreign =
      (next !== '' && !next.startsWith('#/')) || (route.view === 'preview' && parseHash(next).view !== 'preview');
    if (foreign) {
      const state = typeof history.state === 'object' && history.state ? history.state : {};
      history.replaceState({ ...state, [KEY]: hash }, '');
      return;
    }
    hash = next;
    // the browser keeps the scroll position on a hash change; the previous page's position means nothing on the next
    if (route.view === 'list' || (route.view === 'detail' && route.section === null)) tick().then(() => scrollTo(0, 0));
  }
</script>

<svelte:window {onhashchange} {onkeydown} />

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
  <div class="zukan" data-theme={theme}>
    <Sidebar
      entries={catalog}
      current={entry?.path}
      {logo}
      {title}
      {theme}
      ontoggletheme={toggleTheme}
      onshortcuts={() => shortcuts?.showModal()}
      {t}
    />
    <main>
      {#if route.view === 'list'}
        <List entries={catalog} {searched} {t} />
      {:else if entry}
        <Detail {entry} section={route.view === 'detail' ? route.section : null} {previous} {next} {theme} {t} />
      {:else}
        <h1>{t.notFound}</h1>
      {/if}
    </main>
    <!-- inside .zukan, so the dialog gets the catalog's theme -->
    <dialog bind:this={shortcuts} class="shortcuts" aria-labelledby="zukan-shortcuts">
      <h2 id="zukan-shortcuts">{t.shortcuts}</h2>
      <dl>
        <dt><kbd>/</kbd></dt>
        <dd>{t.shortcutSearch}</dd>
        <dt><kbd>J</kbd></dt>
        <dd>{t.shortcutNext}</dd>
        <dt><kbd>K</kbd></dt>
        <dd>{t.shortcutPrevious}</dd>
        <dt><kbd>Esc</kbd></dt>
        <dd>{t.shortcutExpanded}</dd>
        <dt><kbd>?</kbd></dt>
        <dd>{t.shortcutHelp}</dd>
      </dl>
      <form method="dialog"><button>{t.close}</button></form>
    </dialog>
  </div>
{/if}

<style>
  /* the catalog is its own page; the preview's height is measured from its content, so no body margin either */
  :global(body) {
    margin: 0;
  }

  /* the catalog UI follows its theme switch; the preview page (no .zukan) gets the theme from its frame */
  :global(html:has(> body > .zukan[data-theme='light'])) {
    color-scheme: light;
  }

  :global(html:has(> body > .zukan[data-theme='dark'])) {
    color-scheme: dark;
  }

  /* internal theme; the catalog page loads no app CSS, so these are not meant to be overridden */
  .zukan {
    --_bg: #fff;
    --_text: #1f2328;
    --_muted: #59636e;
    --_border: #d1d9e0;
    --_accent: #0969da;
    --_code-bg: #f6f8fa;
    --_syntax-comment: #6e7781;
    --_syntax-string: #0a3069;
    --_syntax-tag: #116329;
    --_syntax-attr: #0550ae;
    --_syntax-keyword: #cf222e;
    --_syntax-block: #8250df;
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

  .zukan[data-theme='dark'] {
    --_bg: #0d1117;
    --_text: #f0f6fc;
    --_muted: #9198a1;
    --_border: #3d444d;
    --_accent: #4493f8;
    --_code-bg: #151b23;
    --_syntax-comment: #9198a1;
    --_syntax-string: #a5d6ff;
    --_syntax-tag: #7ee787;
    --_syntax-attr: #79c0ff;
    --_syntax-keyword: #ff7b72;
    --_syntax-block: #d2a8ff;
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

  .shortcuts {
    min-width: 280px;
    padding: 20px 24px;
    border: 1px solid var(--_border);
    border-radius: 12px;
    background: var(--_bg);
    color: var(--_text);
    font-family: var(--_font);
    box-shadow: 0 24px 64px -12px rgb(0 0 0 / 0.45);
  }

  .shortcuts::backdrop {
    background: rgb(0 0 0 / 0.45);
  }

  .shortcuts h2 {
    margin: 0 0 16px;
    font-size: 16px;
  }

  .shortcuts dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px 16px;
    margin: 0 0 20px;
    font-size: 14px;
  }

  .shortcuts dt {
    text-align: right;
  }

  .shortcuts dd {
    margin: 0;
    color: var(--_muted);
  }

  kbd {
    display: inline-block;
    min-width: 1.6em;
    padding: 1px 6px;
    border: 1px solid var(--_border);
    border-bottom-width: 2px;
    border-radius: 5px;
    background: var(--_code-bg);
    font-family: var(--_mono);
    font-size: 12px;
    text-align: center;
  }

  .shortcuts button {
    padding: 6px 14px;
    border: 1px solid var(--_border);
    border-radius: 6px;
    background: var(--_bg);
    color: var(--_text);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }
</style>
