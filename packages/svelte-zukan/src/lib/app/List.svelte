<script lang="ts">
  import type { Theme } from '../components/PreviewFrame/storage.js';
  import type { Entry } from '../types.js';
  import EntryCard from './EntryCard.svelte';
  import type { Messages } from './i18n.js';

  let {
    entries,
    searched,
    theme,
    t
  }: { entries: Entry[]; searched: { group: string; dirs: string[] }[]; theme: Theme; t: Messages } = $props();

  // the catalog is already in group order; a Map keeps it
  const groups = $derived(
    entries.reduce(
      (map, entry) => map.set(entry.group, [...(map.get(entry.group) ?? []), entry]),
      new Map<string, Entry[]>()
    )
  );

  const id = $props.id();
</script>

<h1>{t.listHeading}</h1>
{#if entries.length}
  {#each groups as [group, items], i (group)}
    <section aria-labelledby="{id}-{i}">
      <h2 id="{id}-{i}">{group} <span class="count">{items.length}</span></h2>
      <ul>
        {#each items as entry (entry.path)}
          <li><EntryCard {entry} {theme} /></li>
        {/each}
      </ul>
    </section>
  {/each}
{:else}
  <p>{t.empty}</p>
  <ul class="searched">
    <!-- group names are not guaranteed unique, so key by index -->
    {#each searched as { group, dirs }, i (i)}
      <li>{group}: {dirs.join(', ')}</li>
    {/each}
  </ul>
{/if}

<style>
  h1 {
    margin: 0 0 16px;
    font-size: 24px;
  }

  section + section {
    margin-top: 28px;
  }

  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px;
    color: var(--_muted);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
    overflow-wrap: anywhere;
  }

  .count {
    padding: 0 7px;
    border-radius: 999px;
    background: var(--_code-bg);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .searched {
    display: block;
    padding-left: 20px;
    list-style: disc;
  }
</style>
