<script lang="ts">
  import EntryList from '../components/EntryList.svelte';
  import type { Entry } from '../types.js';
  import type { Messages } from './i18n.js';

  let { entries, t }: { entries: Entry[]; t: Messages } = $props();
</script>

<h1>{t.listHeading}</h1>
{#if entries.length}
  <EntryList {entries} />
{:else}
  <!-- ponytail: the searched groups and dirs are not passed to the app yet, so only the message is shown -->
  <p>{t.empty}</p>
{/if}

<style>
  h1 {
    margin: 0 0 16px;
    font-size: 24px;
  }
</style>
