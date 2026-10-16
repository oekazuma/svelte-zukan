<script lang="ts">
  import { Section } from 'svelte-zukan';
  import CodeBlock from './CodeBlock.svelte';
</script>

<Section title="基本">
  <CodeBlock code="<button>押す</button>" />
</Section>

<Section title="複数行">
  <CodeBlock code={'const count = $state(0);\nconst label = $derived(`${count} 回`);'} />
</Section>
