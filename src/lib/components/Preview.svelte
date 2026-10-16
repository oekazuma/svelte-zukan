<script lang="ts">
  import { browser } from '$app/env';
  import { page } from '$app/state';
  import { setPreviewSection } from '../context.js';
  import type { Entry } from '../types.js';

  let { entry }: { entry: Entry } = $props();

  // prerender forbids touching searchParams, so read it on the client only; no value -> all sections render
  const section = browser ? page.url.searchParams.get('section') : null;
  if (section !== null) setPreviewSection(section);
</script>

<div data-zukan-preview>
  {#await entry.load() then mod}
    <mod.default />
  {:catch error}
    <p>読み込めませんでした: {error instanceof Error ? error.message : String(error)}</p>
  {/await}
</div>
