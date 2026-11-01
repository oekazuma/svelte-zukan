<script lang="ts">
  import { flushSync, onMount, tick, type Component, type Snippet } from 'svelte';
  import { readTheme, writeTheme, type Theme } from '../components/PreviewFrame/storage.js';
  import type { Entry, TailwindListItem } from '../types.js';
  import Detail from './Detail.svelte';
  import { formatHash, formatTailwindHash, parseHash, type Route } from './hash.js';
  import { messages } from './i18n.js';
  import List from './List.svelte';
  import Preview from './Preview.svelte';
  import SearchDialog, { modifier } from './SearchDialog.svelte';
  import Sidebar from './Sidebar.svelte';
  import Tailwind from './Tailwind.svelte';

  let {
    catalog,
    logo,
    wrapper,
    title,
    locale,
    fixedTheme = null,
    searched,
    uncataloged = [],
    listError = null,
    tailwind = [],
    axe
  }: {
    catalog: Entry[];
    logo: string | null;
    wrapper: (() => Promise<{ default: Component<{ children: Snippet }> }>) | null;
    title: string;
    locale: 'en' | 'ja';
    /** the `theme` option: the only theme, with no way to switch */
    fixedTheme?: Theme | null;
    searched: { group: string; dirs: string[] }[];
    /** `.svelte` files with no catalog file next to them, relative to the Vite root */
    uncataloged?: { group: string; file: string }[];
    /** why the catalog could not be listed (a duplicate ID); the catalog is then empty */
    listError?: string | null;
    /** the Tailwind CSS entries; empty without Tailwind */
    tailwind?: TailwindListItem[];
    /** the source of axe-core, loaded on the first accessibility check */
    axe?: () => Promise<string>;
  } = $props();

  // each history entry the app has shown keeps its catalog route: an ignored hash stays in the URL, so a reload
  // returns to the route, and a hashchange onto an entry that has one is Back or Forward (popstate fires on every
  // hash change, so it can not tell)
  const KEY = 'zukanHash';
  const remembered = () => {
    const state = history.state as Record<string, unknown> | null;
    return typeof state?.[KEY] === 'string' ? (state[KEY] as string) : null;
  };
  function remember(route: string) {
    const state = typeof history.state === 'object' && history.state ? history.state : {};
    try {
      history.replaceState({ ...state, [KEY]: route }, '');
    } catch {
      // Safari throws past about 100 calls in 10 seconds; Back to this entry then scrolls to the top
    }
  }

  const initial = remembered() ?? location.hash;
  let hash = $state(initial);
  remember(initial);

  /** the route came from Back or Forward, whose scroll position the browser restores */
  let restored = $state(false);

  // `fixedTheme` comes from the config, so its initial value is all there is
  // svelte-ignore state_referenced_locally
  let theme = $state<Theme>(
    fixedTheme ??
      themeOf(parseHash(remembered() ?? location.hash)) ??
      readTheme() ??
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );
  function toggleTheme() {
    if (fixedTheme) return;
    theme = theme === 'dark' ? 'light' : 'dark';
    writeTheme(theme);
  }

  // a shared link's theme applies to this tab without replacing the one the viewer chose
  function themeOf(route: Route) {
    return route.view === 'list' || route.view === 'tailwind' ? undefined : route.theme;
  }

  const t = $derived(messages[locale]);
  // what the search covers; an entry with an error only has its page
  const searchedTailwind = $derived(tailwind.filter((s) => !s.error));
  const route = $derived(parseHash(hash));
  const entry = $derived(
    route.view === 'list' || route.view === 'tailwind' ? undefined : catalog.find((e) => e.path === route.path)
  );
  const index = $derived(entry ? catalog.indexOf(entry) : -1);
  const previous = $derived(index > 0 ? catalog[index - 1] : undefined);
  const next = $derived(index === -1 ? (route.view === 'list' ? catalog[0] : undefined) : catalog[index + 1]);

  // only on the catalog page, and only in browsers that implement WebMCP
  onMount(() => {
    const context =
      (navigator as { modelContext?: object }).modelContext ?? (document as { modelContext?: object }).modelContext;
    if (route.view === 'preview' || !context) return;
    const catalogUrl = new URL('catalog.json', location.href.split('#')[0]);
    import('./webmcp.js').then(({ buildTools, fetchCatalog, registerTools }) =>
      registerTools(
        buildTools({
          fetchCatalog: () => fetchCatalog(catalogUrl),
          axe,
          page: location.pathname,
          themes: !fixedTheme,
          open: go,
          currentTheme: () => theme,
          tailwind: tailwind.length > 0
        }),
        context
      )
    );
  });

  let shortcuts: HTMLDialogElement | undefined = $state();
  let searchDialog: ReturnType<typeof SearchDialog> | undefined = $state();
  let main: HTMLElement | undefined = $state();
  let detail: ReturnType<typeof Detail> | undefined = $state();

  /**
   * Opens the search on ⌘K (Ctrl K), while typing too, the sidebar's search box included; true when it took the key.
   * The entry module calls it from a listener it adds before anything else can, and stops the event there
   */
  export function searchKey(e: KeyboardEvent) {
    if (route.view === 'preview') return false;
    const mod = modifier === '⌘' ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    if (!mod || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'k') return false;
    e.preventDefault();
    searchDialog?.open();
    return true;
  }

  function onkeydown(e: KeyboardEvent) {
    if (route.view === 'preview') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    // a key pressed on a dialog's button must not act on the page behind it
    if (target.closest('dialog')) return;
    if (e.key === '?') {
      e.preventDefault();
      shortcuts?.showModal();
      return;
    }
    // Shift or Caps Lock gives an upper-case key
    const key = e.key.toLowerCase();
    if (key === 't') {
      e.preventDefault();
      toggleTheme();
      return;
    }
    if (key === 'f' && detail) {
      e.preventDefault();
      detail.toggleExpanded();
      return;
    }
    const to = key === 'j' ? next : key === 'k' ? previous : undefined;
    if (!to) return;
    e.preventDefault();
    location.hash = formatHash('detail', to.path);
  }

  /** goes to a catalog route as a link to it would, for the search and WebMCP */
  function go(next: string) {
    detail?.revealRoute(next);
    location.hash = next;
  }

  // a replaced entry, not a new one per keystroke; replaceState fires no hashchange, so the route is set here too
  function filterTailwind(query: string) {
    if (route.view !== 'tailwind') return;
    hash = formatTailwindHash(route.source ?? undefined, route.category ?? undefined, query);
    // remembered, as a route an ignored hash left would win on reload, and Back onto the entry is told by it
    const state = typeof history.state === 'object' && history.state ? history.state : {};
    try {
      history.replaceState({ ...state, [KEY]: hash }, '', hash);
    } catch {
      // Safari throws past about 100 calls in 10 seconds; the page shows the filter already, only the URL lags
    }
  }

  // components in a preview and links in a doc can change the hash too; only catalog routes navigate
  function onhashchange() {
    const traversal = remembered();
    const foreign =
      (location.hash !== '' && !location.hash.startsWith('#/')) ||
      (route.view === 'preview' && parseHash(location.hash).view !== 'preview');
    if (foreign && traversal === null) {
      remember(hash);
      return;
    }
    hash = traversal ?? location.hash;
    restored = traversal !== null;
    if (traversal === null) remember(hash);
    theme = fixedTheme ?? themeOf(route) ?? theme;
    // the browser keeps the scroll position on a new hash, where the previous page's position means nothing, and
    // restores the entry's own position on Back and Forward
    if (
      traversal === null &&
      (route.view === 'list' || route.view === 'tailwind' || (route.view === 'detail' && route.section === null))
    )
      tick().then(() => scrollTo(0, 0));
  }

  // the browser restores the scroll position of Back and Forward right after popstate, before hashchange: the entry's
  // page must be there by then, or a position past the end of the page it leaves is cut short
  function onpopstate() {
    if (remembered() === null) return;
    onhashchange();
    flushSync();
  }
</script>

<!-- the entry's listener stops ⌘K before this one; this one is for an App mounted without the entry -->
<svelte:window
  {onhashchange}
  {onpopstate}
  onkeydowncapture={(e) => searchKey(e) && e.stopImmediatePropagation()}
  {onkeydown}
/>

<svelte:head>
  <title
    >{route.view === 'detail' && entry
      ? `${entry.name} | ${title}`
      : route.view === 'tailwind' && tailwind.length
        ? `Tailwind CSS | ${title}`
        : title}</title
  >
</svelte:head>

{#if route.view === 'preview'}
  {#if entry}
    {#key hash}
      <Preview {entry} section={route.section} theme={fixedTheme ?? route.theme} {wrapper} {t} />
    {/key}
  {:else}
    <p>{t.notFound}</p>
  {/if}
{:else}
  <div class="zukan" data-theme={theme}>
    <!-- focuses main without a hash: the hash is the catalog's route -->
    <a
      class="skip"
      href="#zukan-main"
      onclick={(e) => {
        e.preventDefault();
        main?.focus();
      }}>{t.skipToContent}</a
    >
    <Sidebar
      entries={catalog}
      current={entry?.path}
      {logo}
      {title}
      {theme}
      ontoggletheme={fixedTheme ? undefined : toggleTheme}
      onshortcuts={() => shortcuts?.showModal()}
      onsearch={() => searchDialog?.open()}
      {tailwind}
      currentTailwind={route.view === 'tailwind'
        ? (tailwind.find((s) => s.id === route.source) ?? tailwind[0])?.id
        : undefined}
      {t}
    />
    <main id="zukan-main" tabindex="-1" bind:this={main}>
      {#if route.view === 'list'}
        <List entries={catalog} {searched} {uncataloged} {listError} {tailwind} {theme} {t} />
      {:else if route.view === 'tailwind' && tailwind.length}
        <Tailwind
          sources={tailwind}
          source={route.source}
          category={route.category}
          query={route.q ?? ''}
          onquery={filterTailwind}
          {theme}
          {locale}
          {t}
        />
      {:else if entry}
        <!-- a new page per entry, so no PreviewFrame keeps the previous entry's size and no state carries over -->
        {#key entry.path}
          <Detail
            bind:this={detail}
            {entry}
            section={route.view === 'detail' ? route.section : null}
            width={route.view === 'detail' ? route.width : undefined}
            {restored}
            {previous}
            {next}
            {theme}
            {axe}
            {t}
          />
        {/key}
      {:else if listError}
        <!-- the entry may be missing only because the catalog could not be listed -->
        <List entries={catalog} {searched} {uncataloged} {listError} {tailwind} {theme} {t} />
      {:else}
        <h1>{t.notFound}</h1>
        <p class="missing">{t.notFoundHint}</p>
        <p class="missing">
          <!-- the catalog is a hash-routed SPA outside SvelteKit, so resolve() does not apply -->
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
          <a href="#/">{t.notFoundBack}</a>
          <button type="button" onclick={() => searchDialog?.open()}>{t.searchCatalog}</button>
        </p>
      {/if}
    </main>
    <!-- inside .zukan, so the dialog gets the catalog's theme -->
    <dialog bind:this={shortcuts} class="shortcuts" aria-labelledby="zukan-shortcuts">
      <h2 id="zukan-shortcuts">{t.shortcuts}</h2>
      <dl>
        <dt><kbd>/</kbd></dt>
        <dd>{t.shortcutSearch}</dd>
        <dt><kbd>{modifier}</kbd> <kbd>K</kbd></dt>
        <dd>{searchedTailwind.length ? t.shortcutSearchCatalogTailwind : t.shortcutSearchCatalog}</dd>
        <dt><kbd>J</kbd></dt>
        <dd>{t.shortcutNext}</dd>
        <dt><kbd>K</kbd></dt>
        <dd>{t.shortcutPrevious}</dd>
        {#if !fixedTheme}
          <dt><kbd>T</kbd></dt>
          <dd>{t.shortcutTheme}</dd>
        {/if}
        <dt><kbd>F</kbd></dt>
        <dd>{t.shortcutExpand}</dd>
        <dt><kbd>Esc</kbd></dt>
        <dd>{t.shortcutExpanded}</dd>
        <dt><kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd></dt>
        <dd>{t.shortcutTree}</dd>
        <dt><kbd>?</kbd></dt>
        <dd>{t.shortcutHelp}</dd>
      </dl>
      <form method="dialog"><button>{t.close}</button></form>
    </dialog>
    <SearchDialog bind:this={searchDialog} entries={catalog} {go} tailwind={searchedTailwind} {locale} {t} />
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

  /* the catalog's own motion only: a preview is a separate document, so the component's motion is shown as it is */
  @media (prefers-reduced-motion: reduce) {
    .zukan :global(*) {
      transition: none !important;
      animation: none !important;
    }
  }

  /* internal theme; the catalog page loads no app CSS, so these are not meant to be overridden */
  .zukan {
    --_bg: #fff;
    --_text: #1f2328;
    --_muted: #59636e;
    --_border: #d1d9e0;
    --_accent: #0969da;
    --_code-bg: #f6f8fa;
    --_success: #1a7f37;
    --_danger: #cf222e;
    --_danger-bg: #ffebe9;
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

  .skip {
    position: fixed;
    top: 8px;
    left: 8px;
    z-index: 10;
    padding: 8px 12px;
    border-radius: 6px;
    background: var(--_text);
    color: var(--_bg);
    font-weight: 600;
    text-decoration: none;
    transform: translateY(calc(-100% - 16px));
  }

  .skip:focus {
    transform: none;
  }

  main:focus {
    outline: none;
  }

  .zukan[data-theme='dark'] {
    --_bg: #0d1117;
    --_text: #f0f6fc;
    --_muted: #9198a1;
    --_border: #3d444d;
    --_accent: #4493f8;
    --_code-bg: #151b23;
    --_success: #3fb950;
    --_danger: #ff7b72;
    --_danger-bg: #3c1618;
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

  .missing {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin: 0 0 12px;
    color: var(--_muted);
  }

  .missing :is(a, button) {
    padding: 0;
    border: 0;
    background: none;
    color: var(--_accent);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }

  .missing :is(a, button):focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
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
