<script lang="ts">
  import EntryList from '../components/EntryList.svelte';
  import type { Entry } from '../types.js';
  import type { Messages } from './i18n.js';

  let { entries, searched, t }: { entries: Entry[]; searched: { group: string; dirs: string[] }[]; t: Messages } =
    $props();
</script>

<h1>{t.listHeading}</h1>
{#if entries.length}
  <EntryList {entries} />
{:else}
  <p>{t.empty}</p>
  <ul>
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
</style>
