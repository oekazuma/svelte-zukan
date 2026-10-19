<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import { setPreviewSection } from '../context.js';
  import type { Entry } from '../types.js';
  import type { Messages } from './i18n.js';

  let {
    entry,
    section,
    wrapper,
    t
  }: {
    entry: Entry;
    section: string | null;
    wrapper: (() => Promise<{ default: Component<{ children: Snippet }> }>) | null;
    t: Messages;
  } = $props();

  // the parent keys this component on the hash, so reading the initial value is enough
  // svelte-ignore state_referenced_locally
  if (section !== null) setPreviewSection(section);
</script>

<!-- the wrapper is imported only here, so its global CSS never reaches the catalog UI -->
<div data-zukan-preview>
  {#await Promise.all([wrapper?.(), entry.load()]) then [w, mod]}
    {#if w}
      <w.default><mod.default /></w.default>
    {:else}
      <mod.default />
    {/if}
  {:catch error}
    <p>{t.loadFailed} {error instanceof Error ? error.message : String(error)}</p>
  {/await}
</div>

<style>
  /* keeps child margins inside, so the measured height covers them */
  div {
    display: flow-root;
  }
</style>
