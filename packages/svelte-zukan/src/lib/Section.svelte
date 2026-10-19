<script lang="ts">
  import { getContext, type Snippet } from 'svelte';
  import { PREVIEW_SECTION_KEY } from './context.js';

  let { title, children }: { title: string; children: Snippet } = $props();

  // no context (outside the catalog, or a preview without ?section) -> always render
  const section = getContext<string | undefined>(PREVIEW_SECTION_KEY);
</script>

{#if section === undefined || section === title}
  {@render children()}
{/if}
