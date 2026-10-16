<script lang="ts">
  import type { Entry } from '../types.js';
  import Badge from './Badge/Badge.svelte';

  let { entries, base, current }: { entries: Entry[]; base: string; current?: string } = $props();
</script>

<ul>
  {#each entries as entry (entry.path)}
    <li>
      <!-- base already includes paths.base (derived from page.url.pathname), so resolve() would double it -->
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <a href="{base}/{entry.path}" aria-current={entry.path === current ? 'page' : undefined}>
        <span>{entry.name}</span>
        <Badge label={entry.group} />
      </a>
    </li>
  {/each}
</ul>

<style>
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: var(--_font);
  }

  a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 6px;
    color: var(--_text);
    text-decoration: none;
  }

  a:hover {
    background: var(--_code-bg);
  }

  a[aria-current='page'] {
    color: var(--_accent);
    background: var(--_code-bg);
    font-weight: 600;
  }
</style>
