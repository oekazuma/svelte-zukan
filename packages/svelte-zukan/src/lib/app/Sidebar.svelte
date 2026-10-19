<script lang="ts">
  import { tick } from 'svelte';
  import EntryList from '../components/EntryList.svelte';
  import type { Entry } from '../types.js';
  import type { Messages } from './i18n.js';

  let {
    entries,
    current,
    logo,
    title,
    t
  }: { entries: Entry[]; current?: string; logo: string | null; title: string; t: Messages } = $props();

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

<svelte:window {onkeydown} />

<div class="sidebar">
  <div class="header">
    <a class="logo" href="#/">
      {#if logo}
        <img src={logo} alt={title} />
      {:else}
        {title}
      {/if}
    </a>
    <button type="button" class="menu" aria-expanded={open} aria-controls="zukan-panel" onclick={() => (open = !open)}>
      {t.menu}
    </button>
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
