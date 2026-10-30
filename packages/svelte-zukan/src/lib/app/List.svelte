<script lang="ts">
  import type { Theme } from '../components/PreviewFrame/storage.js';
  import type { Entry, TailwindListItem } from '../types.js';
  import EntryCard from './EntryCard.svelte';
  import type { Messages } from './i18n.js';
  import TailwindCard from './TailwindCard.svelte';

  let {
    entries,
    searched,
    uncataloged = [],
    listError = null,
    tailwind = [],
    theme,
    t
  }: {
    entries: Entry[];
    searched: { group: string; dirs: string[] }[];
    uncataloged?: { group: string; file: string }[];
    listError?: string | null;
    tailwind?: TailwindListItem[];
    theme: Theme;
    t: Messages;
  } = $props();

  // the catalog is already in group order; a Map keeps it
  const groups = $derived(Map.groupBy(entries, (entry) => entry.group));

  const id = $props.id();
</script>

<h1>{t.listHeading}</h1>
<!-- first: below every group it would be as easy to miss as the sidebar's link -->
{#if tailwind.length}
  <section aria-labelledby="{id}-tailwind">
    <h2 id="{id}-tailwind">{t.tailwind}</h2>
    <ul>
      {#each tailwind as item (item.id)}
        <li><TailwindCard {item} {t} /></li>
      {/each}
    </ul>
  </section>
{/if}
{#if listError}
  <p class="list-error">{t.loadFailed} {listError}</p>
{:else if entries.length}
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

{#if uncataloged.length}
  <details class="uncataloged">
    <summary>{t.uncataloged} <span class="count">{uncataloged.length}</span></summary>
    <p>{t.uncatalogedHint}</p>
    <ul>
      {#each uncataloged as u (u.file)}
        <!-- a long path wraps after a slash rather than inside a name -->
        <li>
          <code
            >{#each u.file.split('/') as part, i (i)}{#if i}/<wbr />{/if}{part}{/each}</code
          >
        </li>
      {/each}
    </ul>
  </details>
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

  .uncataloged {
    margin-top: 32px;
    color: var(--_muted);
    font-size: 13px;
  }

  .uncataloged summary {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    cursor: pointer;
  }

  .uncataloged p {
    margin: 8px 0;
  }

  .uncataloged ul {
    display: block;
    columns: 18rem;
    padding-left: 18px;
    list-style: disc;
  }

  .uncataloged code {
    font-family: var(--_mono);
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .searched {
    display: block;
    padding-left: 20px;
    list-style: disc;
  }

  /* the message lists the colliding files on lines of their own */
  .list-error {
    white-space: pre-wrap;
  }
</style>
