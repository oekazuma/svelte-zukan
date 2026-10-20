<script lang="ts">
  import { tick } from 'svelte';
  import EntryList from '../components/EntryList.svelte';
  import type { Theme } from '../components/PreviewFrame/storage.js';
  import type { Entry } from '../types.js';
  import type { Messages } from './i18n.js';

  let {
    entries,
    current,
    logo,
    title,
    theme,
    ontoggletheme,
    t
  }: {
    entries: Entry[];
    current?: string;
    logo: string | null;
    title: string;
    theme: Theme;
    ontoggletheme: () => void;
    t: Messages;
  } = $props();

  let query = $state('');
  // only on narrow screens, where the panel folds under the menu button
  let open = $state(false);
  let search: HTMLInputElement;

  const matches = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return q ? entries.filter((e) => e.path.toLowerCase().includes(q)) : entries;
  });

  async function onkeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    e.preventDefault();
    open = true;
    // on narrow screens the panel is display: none until `open` is applied
    await tick();
    search.focus();
  }
</script>

<svelte:window {onkeydown} onhashchange={() => (open = false)} />

<div class="sidebar">
  <div class="header">
    <a class="logo" href="#/">
      {#if logo}
        <img src={logo} alt={title} />
      {:else}
        {title}
      {/if}
    </a>
    <div class="actions">
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
      placeholder="{t.search} (/)"
      aria-label={t.search}
      autocomplete="off"
    />
    <!-- following a link closes the panel on narrow screens; the links themselves handle the keyboard -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <nav aria-label={t.nav} onclick={() => (open = false)}>
      {#if matches.length}
        <EntryList entries={matches} {current} />
      {:else}
        <p>{t.noMatches}</p>
      {/if}
    </nav>
  </div>
</div>

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
    color: var(--_text);
    font-size: 20px;
    font-weight: 600;
    text-decoration: none;
  }

  img {
    display: block;
    height: 32px;
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
