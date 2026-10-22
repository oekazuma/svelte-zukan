<script lang="ts">
  import { formatHash } from '../app/hash.js';
  import type { Entry } from '../types.js';

  let {
    entries,
    current,
    hits = new Map()
  }: {
    entries: Entry[];
    current?: string;
    /** section titles that matched a search, by entry path */
    hits?: Map<string, string[]>;
  } = $props();

  type Folder = { name: string; count: number; items: (Folder | Entry)[] };
  const isFolder = (item: Folder | Entry): item is Folder => 'items' in item;

  function tree(items: Entry[]): Folder {
    const root: Folder = { name: '', count: 0, items: [] };
    for (const entry of items) {
      let folder = root;
      folder.count++;
      for (const name of entry.dir ? entry.dir.split('/') : []) {
        let next = folder.items.find((i): i is Folder => isFolder(i) && i.name === name);
        if (!next) folder.items.push((next = { name, count: 0, items: [] }));
        next.count++;
        folder = next;
      }
      folder.items.push(entry);
    }
    return root;
  }

  // the catalog is already in group order; a Map keeps it
  const groups = $derived(Map.groupBy(entries, (entry) => entry.group));
  const id = $props.id();
</script>

{#snippet list(folder: Folder, labelledby?: string)}
  <ul aria-labelledby={labelledby}>
    {#each folder.items as item (isFolder(item) ? `/${item.name}` : item.path)}
      <li>
        {#if isFolder(item)}
          <details open>
            <summary><span class="folder">{item.name}</span><span class="count">{item.count}</span></summary>
            {@render list(item)}
          </details>
        {:else}
          <!-- the catalog is a hash-routed SPA outside SvelteKit, so resolve() does not apply -->
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
          <a href={formatHash('detail', item.path)} aria-current={item.path === current ? 'page' : undefined}>
            {item.name}
          </a>
          {#if hits.get(item.path)?.length}
            <ul class="hits">
              {#each hits.get(item.path)! as title (title)}
                <li>
                  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
                  <a href={formatHash('detail', item.path, title)}>{title}</a>
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

{#each groups as [group, items], i (group)}
  {#if groups.size > 1}
    <!-- the list is named by the group alone, not by its count -->
    <div class="group"><span id="{id}-{i}">{group}</span><span class="count">{items.length}</span></div>
  {/if}
  {@render list(tree(items), groups.size > 1 ? `${id}-${i}` : undefined)}
{/each}

<style>
  .group {
    display: flex;
    align-items: center;
    gap: 6px;
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

  .count {
    padding: 0 6px;
    border-radius: 999px;
    background: var(--_code-bg);
    color: var(--_muted);
    font-size: 11px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: var(--_font);
  }

  details ul {
    margin-left: 14px;
    padding-left: 6px;
    border-left: 1px solid var(--_border);
  }

  summary {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 6px;
    color: var(--_muted);
    font-size: 13px;
    cursor: pointer;
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary::before {
    content: '';
    width: 6px;
    height: 6px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg);
    transition: transform 0.15s;
  }

  details[open] > summary::before {
    transform: rotate(45deg);
  }

  summary:hover {
    background: var(--_code-bg);
    color: var(--_text);
  }

  .folder {
    flex: 1;
    overflow-wrap: anywhere;
  }

  a {
    display: block;
    padding: 6px 10px;
    border-radius: 6px;
    color: var(--_text);
    text-decoration: none;
    overflow-wrap: anywhere;
  }

  a:hover {
    background: var(--_code-bg);
  }

  a[aria-current='page'] {
    color: var(--_accent);
    background: var(--_code-bg);
    font-weight: 600;
  }

  .hits a {
    padding: 3px 10px 3px 22px;
    color: var(--_muted);
    font-size: 13px;
  }

  /* a guide mark drawn with a border, so nothing is added to the link's accessible name */
  .hits a {
    position: relative;
  }

  .hits a::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 12px;
    width: 5px;
    border-top: 1px solid var(--_border);
  }
</style>
