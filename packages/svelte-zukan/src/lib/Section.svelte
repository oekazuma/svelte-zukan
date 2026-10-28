<script lang="ts">
  import { getContext, type Snippet } from 'svelte';
  import { PREVIEW_SECTION_KEY } from './context.js';

  let { title, children }: { title: string; children?: Snippet } = $props();

  // no context (outside the catalog, or a preview without ?section) -> always render
  const section = getContext<string | undefined>(PREVIEW_SECTION_KEY);
  // the section in the URL comes from `extractSections`, which reads the file with LF line endings, while a CRLF
  // checkout compiles a multi-line `title` with \r\n
</script>

{#if section === undefined || section === title.replace(/\r\n?/g, '\n')}
  {@render children?.()}
{/if}
