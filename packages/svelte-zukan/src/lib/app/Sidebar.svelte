<script lang="ts">
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
</script>

<div class="sidebar">
  <a class="logo" href="#/">
    {#if logo}
      <img src={logo} alt={title} />
    {:else}
      {title}
    {/if}
  </a>
  <nav aria-label={t.nav}><EntryList {entries} {current} /></nav>
</div>

<style>
  .sidebar {
    padding: 16px 8px;
    border-right: 1px solid var(--_border);
  }

  .logo {
    display: block;
    margin: 0 10px 16px;
    color: var(--_text);
    font-size: 20px;
    font-weight: 600;
    text-decoration: none;
  }

  img {
    display: block;
    height: 32px;
  }
</style>
