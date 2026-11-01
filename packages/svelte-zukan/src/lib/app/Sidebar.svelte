<script lang="ts">
  import { tick } from 'svelte';
  import EntryList from '../components/EntryList.svelte';
  import type { Theme } from '../components/PreviewFrame/storage.js';
  import type { Entry } from '../types.js';
  import { followsHere, formatTailwindHash } from './hash.js';
  import type { Messages } from './i18n.js';
  import { modifier } from './SearchDialog.svelte';

  let {
    entries,
    current,
    logo,
    title,
    theme,
    ontoggletheme,
    onshortcuts,
    onsearch,
    tailwind,
    currentTailwind,
    t
  }: {
    entries: Entry[];
    current?: string;
    logo: string | null;
    title: string;
    theme: Theme;
    /** left out when the `theme` option fixes the theme */
    ontoggletheme?: () => void;
    onshortcuts: () => void;
    onsearch: () => void;
    tailwind: { id: string; file: string }[];
    currentTailwind?: string;
    t: Messages;
  } = $props();

  let query = $state('');
  // only on narrow screens, where the panel folds under the menu button
  let open = $state(false);
  let search: HTMLInputElement;

  // section titles live in each entry's metadata module, so they are loaded on the first search only
  let titles = $state.raw<Map<string, string[]>>();
  let loadingTitles = false;
  function loadTitles() {
    if (titles || loadingTitles) return;
    loadingTitles = true;
    Promise.all(
      entries.map(async (e): Promise<[string, string[]]> => {
        try {
          return [e.path, (await e.meta()).default.sections.map((s) => s.title)];
        } catch {
          // a broken file still shows its own error on its page; the search just matches its ID
          return [e.path, []];
        }
      })
    ).then((pairs) => (titles = new Map(pairs)));
  }

  const matches = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { entries, hits: new Map<string, string[]>() };
    const sections = entries.map(
      (e) => [e.path, (titles?.get(e.path) ?? []).filter((title) => title.toLowerCase().includes(q))] as const
    );
    const hits = new Map(sections.filter(([, found]) => found.length));
    return { entries: entries.filter((e) => e.path.toLowerCase().includes(q) || hits.has(e.path)), hits };
  });

  /** ↑ ↓ Home End move between the links and folders shown; → opens a folder, ← closes it or goes to its parent */
  function moveInTree(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    const target = e.target as HTMLElement;
    const items = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('a[href], summary')].filter((el) =>
      el.checkVisibility()
    );
    const i = items.indexOf(target);
    if (i === -1) return;
    const folder = target.tagName === 'SUMMARY' ? (target.parentElement as HTMLDetailsElement) : null;
    let to: HTMLElement | undefined;
    if (e.key === 'ArrowDown') to = items[i + 1];
    else if (e.key === 'ArrowUp') to = items[i - 1];
    else if (e.key === 'Home') to = items[0];
    else if (e.key === 'End') to = items.at(-1);
    else if (e.key === 'ArrowRight' && folder) {
      if (folder.open) to = items[i + 1];
      else folder.open = true;
    } else if (e.key === 'ArrowLeft') {
      if (folder?.open) folder.open = false;
      else
        to =
          (folder?.parentElement ?? target).closest('details')?.querySelector<HTMLElement>(':scope > summary') ??
          undefined;
    } else return;
    e.preventDefault();
    to?.focus();
  }

  async function onkeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (target.closest('dialog')) return;
    e.preventDefault();
    open = true;
    // on narrow screens the panel is display: none until `open` is applied
    await tick();
    search.focus();
  }
</script>

<svelte:window {onkeydown} onhashchange={() => (open = false)} />

<header class="sidebar">
  <div class="header">
    <a class="logo" href="#/">
      {#if logo}
        <img src={logo} alt={title} />
      {:else}
        {title}
      {/if}
    </a>
    <div class="actions">
      <button type="button" class="theme" title="{t.searchCatalog} ({modifier} K)" onclick={onsearch}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" stroke-linecap="round" />
        </svg>
        <span class="sr-only">{t.searchCatalog}</span>
      </button>
      <button type="button" class="theme keys" title="{t.shortcuts} (?)" onclick={onshortcuts}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <rect x="2.5" y="6" width="19" height="12" rx="2" />
          <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" stroke-linecap="round" />
        </svg>
        <span class="sr-only">{t.shortcuts}</span>
      </button>
      {#if ontoggletheme}
        <button type="button" class="theme" aria-pressed={theme === 'dark'} title={t.darkMode} onclick={ontoggletheme}>
          <!-- the icon shows the current theme; the button's name and pressed state say what it does -->
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            {#if theme === 'dark'}
              <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" stroke-linejoin="round" />
            {:else}
              <circle cx="12" cy="12" r="4" />
              <path
                d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
                stroke-linecap="round"
              />
            {/if}
          </svg>
          <span class="sr-only">{t.darkMode}</span>
        </button>
      {/if}
      <button
        type="button"
        class="menu"
        aria-expanded={open}
        aria-controls="zukan-panel"
        onclick={() => (open = !open)}
      >
        {t.menu}
      </button>
    </div>
  </div>
  <div class="panel" class:open id="zukan-panel">
    <input
      type="search"
      bind:this={search}
      bind:value={query}
      oninput={loadTitles}
      placeholder="{t.search} (/)"
      aria-label={t.search}
      autocomplete="off"
    />
    <!-- once the section titles are in, so the count is said once -->
    <div class="sr-only" role="status">
      {#if query.trim() && titles}
        {matches.entries.length ? `${t.searchResults}: ${matches.entries.length}` : t.noMatches}
      {/if}
    </div>
    <!-- following a link closes the panel on narrow screens, also one to the page shown, which fires no hashchange;
         a folder keeps it open. The links themselves handle the keyboard -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <nav
      aria-label={t.nav}
      onclick={async (e) => {
        const link = (e.target as Element).closest('a[href]');
        if (!(link instanceof HTMLAnchorElement && followsHere(e, link))) return;
        // read before the panel folds: hiding it can blur the link before tick() resolves
        const wasFocused = document.activeElement === link;
        open = false;
        await tick();
        // the folded panel hides the focused link, which would leave the focus on the body
        if (wasFocused && !link.checkVisibility())
          document.getElementById('zukan-main')?.focus({ preventScroll: true });
      }}
      onkeydown={moveInTree}
    >
      {#if matches.entries.length}
        <!-- re-created when a search starts or ends, so every folder is open while searching -->
        {#key !!query.trim()}
          <EntryList entries={matches.entries} hits={matches.hits} {current} />
        {/key}
      {:else if query.trim() && titles}
        <p>{t.noMatches}</p>
      {/if}
      {#if tailwind.length}
        <ul class="tailwind">
          {#each tailwind as item (item.id)}
            <li>
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
              <a href={formatTailwindHash(item.id)} aria-current={item.id === currentTailwind ? 'page' : undefined}>
                {t.tailwind}{tailwind.length > 1 ? ` (${item.file})` : ''}
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </nav>
  </div>
</header>

<style>
  .sidebar {
    position: sticky;
    top: 0;
    box-sizing: border-box;
    height: 100vh;
    overflow-y: auto;
    padding: 16px 8px;
    border-right: 1px solid var(--_border);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 0 10px 16px;
  }

  .logo {
    display: block;
    min-width: 0;
    color: var(--_text);
    font-size: 20px;
    font-weight: 600;
    text-decoration: none;
    overflow-wrap: anywhere;
  }

  img {
    display: block;
    max-width: 100%;
    height: 32px;
    object-fit: contain;
    object-position: left;
  }

  .actions {
    display: flex;
    gap: 6px;
  }

  .theme {
    display: inline-grid;
    place-items: center;
    padding: 5px;
    color: var(--_muted);
    cursor: pointer;
  }

  .theme:hover {
    color: var(--_text);
  }

  /* a touch screen has no keyboard to use the shortcuts with */
  @media (hover: none) and (pointer: coarse) {
    .keys {
      display: none;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .menu {
    display: none;
  }

  button,
  input {
    box-sizing: border-box;
    padding: 4px 8px;
    border: 1px solid var(--_border);
    border-radius: 6px;
    background: var(--_bg);
    color: var(--_text);
    font: inherit;
    font-size: 14px;
  }

  input {
    width: calc(100% - 20px);
    margin: 0 10px 12px;
  }

  input:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: -1px;
  }

  .tailwind {
    margin: 12px 0 0;
    padding: 12px 0 0;
    border-top: 1px solid var(--_border);
    list-style: none;
    font-family: var(--_font);
  }

  /* drawn like the component links */
  .tailwind a {
    display: block;
    padding: 6px 10px;
    border-radius: 6px;
    color: var(--_text);
    text-decoration: none;
    overflow-wrap: anywhere;
  }

  .tailwind a:hover {
    background: var(--_code-bg);
  }

  .tailwind a[aria-current='page'] {
    color: var(--_accent);
    background: var(--_code-bg);
    font-weight: 600;
  }

  p {
    margin: 0 10px;
    color: var(--_muted);
    font-size: 14px;
  }

  @media (max-width: 767px) {
    .sidebar {
      position: static;
      height: auto;
      padding: 12px 8px;
      border-right: 0;
      border-bottom: 1px solid var(--_border);
    }

    .header {
      margin-bottom: 0;
    }

    .menu {
      display: block;
    }

    .panel {
      display: none;
      margin-top: 12px;
    }

    .panel.open {
      display: block;
    }
  }
</style>
