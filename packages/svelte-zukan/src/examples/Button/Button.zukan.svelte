<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from './Button.svelte';

  let count = $state(0);
  const label = $derived(`${count} clicks`);
</script>

<Section title="Basic">
  <Button onclick={() => count++}>{label}</Button>
</Section>

<Section title="Disabled">
  <Button disabled>Disabled</Button>
</Section>
