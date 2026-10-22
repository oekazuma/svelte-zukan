<script lang="ts">
  import { setContext, type Component, type Snippet } from 'svelte';
  import { BACKGROUNDS, readTheme, type Theme } from '../components/PreviewFrame/storage.js';
  import { PREVIEW_SECTION_KEY } from '../context.js';
  import type { Entry } from '../types.js';
  import type { Messages } from './i18n.js';

  let {
    entry,
    section,
    theme,
    wrapper,
    t
  }: {
    entry: Entry;
    section: string | null;
    theme?: Theme;
    wrapper: (() => Promise<{ default: Component<{ children: Snippet }> }>) | null;
    t: Messages;
  } = $props();

  // the parent keys this component on the hash, so reading the initial value is enough
  // svelte-ignore state_referenced_locally
  if (section !== null) setContext(PREVIEW_SECTION_KEY, section);

  // a preview opened in its own tab has no catalog page to set it. Inside the catalog the frame sets it, and it can
  // differ from the stored one (a shared link's theme), so the stored one must not override it once this mounts
  let framed = false;
  try {
    framed = window !== parent && parent.location.pathname === location.pathname;
  } catch {
    // a cross-origin parent is not the catalog
  }
  // svelte-ignore state_referenced_locally
  const stored = theme ?? (framed ? null : readTheme());
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
    <!-- runAxe reports this instead of checking it -->
    <p data-zukan-error>{t.loadFailed} {error instanceof Error ? error.message : String(error)}</p>
  {/await}
</div>

<style>
  /* keeps child margins inside, so the measured height covers them */
  div {
    display: flow-root;
  }
</style>
