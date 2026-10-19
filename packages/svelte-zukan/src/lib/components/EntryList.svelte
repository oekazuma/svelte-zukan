<script lang="ts">
  import { formatHash } from '../app/hash.js';
  import type { Entry } from '../types.js';
  import Badge from './Badge/Badge.svelte';

  let { entries, current }: { entries: Entry[]; current?: string } = $props();
</script>

<ul>
  {#each entries as entry (entry.path)}
    <li>
      <!-- the catalog is a hash-routed SPA outside SvelteKit, so resolve() does not apply -->
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <a href={formatHash('detail', entry.path)} aria-current={entry.path === current ? 'page' : undefined}>
        <span class="name">
          {entry.name}
          {#if entry.dir}<span class="dir">{entry.dir}</span>{/if}
        </span>
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

  .name {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .dir {
    margin-left: 4px;
    color: var(--_muted);
    font-size: 12px;
    font-weight: normal;
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
