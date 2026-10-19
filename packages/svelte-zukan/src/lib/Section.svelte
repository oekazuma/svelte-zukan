<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getPreviewSection } from './context.js';

  let { title, children }: { title: string; children: Snippet } = $props();

  // no context (outside the catalog, or a preview without ?section) -> always render
  const section = getPreviewSection();
</script>

{#if section === undefined || section === title}
  {@render children()}
{/if}
