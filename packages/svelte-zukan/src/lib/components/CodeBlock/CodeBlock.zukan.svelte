<script lang="ts">
  import { Section } from 'svelte-zukan';
  import CodeBlock from './CodeBlock.svelte';
</script>

<Section title="Basic">
  <CodeBlock code="<button>Press</button>" />
</Section>

<Section title="Multiple lines">
  <CodeBlock code={'const count = $state(0);\nconst label = $derived(`${count} clicks`);'} />
</Section>
