<script lang="ts">
  import { setContext, tick, type Component, type Snippet } from 'svelte';
  import { BACKGROUNDS, paint, readTheme, type Theme } from '../components/PreviewFrame/storage.js';
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

  // svelte-ignore state_referenced_locally
  const loaded = Promise.all([wrapper?.(), entry.load()]);
  /** the content or its error is in: what a check of this page (webmcp.ts) waits for, as an element may never come */
  let settled = $state(false);
  // the theme's color covers the page until the wrapper brings the app's CSS, which may paint html or body itself; read
  // once the content is mounted, as a component's own styles are added then. A newer preview (another hash) owns the
  // page once this one is gone
  $effect(() => {
    let mounted = true;
    loaded.then(tick, tick).then(() => {
      settled = true;
      if (mounted && stored) paint(document, stored);
    });
    return () => {
      mounted = false;
    };
  });
</script>

<!-- the wrapper is imported only here, so its global CSS never reaches the catalog UI -->
<div data-zukan-preview data-zukan-ready={settled || undefined}>
  {#await loaded then [w, mod]}
    <svelte:boundary>
      {#if w}
        <w.default><mod.default /></w.default>
      {:else}
        <mod.default />
      {/if}
      {#snippet failed(error)}
        {@render failure(t.renderFailed, error)}
      {/snippet}
    </svelte:boundary>
  {:catch error}
    {@render failure(t.loadFailed, error)}
  {/await}
</div>

{#snippet failure(label: string, error: unknown)}
  <!-- runAxe reports this instead of checking it -->
  <p data-zukan-error>{label} {error instanceof Error ? error.message : String(error)}</p>
{/snippet}

<style>
  /* keeps child margins inside, so the measured height covers them */
  div {
    display: flow-root;
  }
</style>
