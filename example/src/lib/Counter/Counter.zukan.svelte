<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Counter from './Counter.svelte';
</script>

<Section title="Default">
  <Counter />
</Section>

<Section title="With a label">
  <Counter label="Likes" />
</Section>
