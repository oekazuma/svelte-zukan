<script lang="ts">
  import { formatHash } from '../app/hash.js';
  import type { Entry } from '../types.js';

  let { entries, current }: { entries: Entry[]; current?: string } = $props();

  // the catalog is already in group order; a Map keeps it
  const groups = $derived(
    entries.reduce(
      (map, entry) => map.set(entry.group, [...(map.get(entry.group) ?? []), entry]),
      new Map<string, Entry[]>()
    )
  );
  const id = $props.id();
</script>

<!-- group names are shown only when there is more than one group -->
{#each groups as [group, items], i (group)}
  {#if groups.size > 1}<div class="group" id="{id}-{i}">{group}</div>{/if}
  <ul aria-labelledby={groups.size > 1 ? `${id}-${i}` : undefined}>
    {#each items as entry (entry.path)}
      <li>
        <!-- the catalog is a hash-routed SPA outside SvelteKit, so resolve() does not apply -->
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a href={formatHash('detail', entry.path)} aria-current={entry.path === current ? 'page' : undefined}>
          {entry.name}
          {#if entry.dir}<span class="dir">{entry.dir}</span>{/if}
        </a>
      </li>
    {/each}
  </ul>
{/each}

<style>
  .group {
    margin: 16px 10px 4px;
    color: var(--_muted);
    font-family: var(--_font);
    font-size: 12px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .group:first-child {
    margin-top: 0;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: var(--_font);
  }

  a {
    display: block;
    padding: 6px 10px;
    border-radius: 6px;
    color: var(--_text);
    text-decoration: none;
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
