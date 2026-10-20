<script lang="ts">
  import { setContext, type Component, type Snippet } from 'svelte';
  import { BACKGROUNDS, readTheme } from '../components/PreviewFrame/storage.js';
  import { PREVIEW_SECTION_KEY } from '../context.js';
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
  if (section !== null) setContext(PREVIEW_SECTION_KEY, section);

  // a preview opened in its own tab has no catalog page to set it; inside the catalog, the frame sets the same value
  const stored = readTheme();
  if (stored) {
    document.documentElement.style.colorScheme = stored;
    document.documentElement.style.backgroundColor = BACKGROUNDS[stored];
  }
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
