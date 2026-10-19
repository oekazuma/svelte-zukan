<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from './Button.svelte';

  let count = $state(0);
  const label = $derived(`${count} 回押した`);
</script>

<Section title="基本">
  <Button onclick={() => count++}>{label}</Button>
</Section>

<Section title="無効">
  <Button disabled>押せない</Button>
</Section>
