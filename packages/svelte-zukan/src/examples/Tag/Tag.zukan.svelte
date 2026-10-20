<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from '../Button/Button.svelte';
  import Tag from './Tag.svelte';

  const initial = ['Svelte', 'Vite', 'TypeScript', 'Design system'];
  let tags = $state([...initial]);
</script>

<Section title="Tones">
  <div class="demo-row">
    <Tag>Draft</Tag>
    <Tag tone="accent">New</Tag>
    <Tag tone="success">Published</Tag>
    <Tag tone="warning">Review</Tag>
    <Tag tone="danger">Blocked</Tag>
  </div>
</Section>

<Section title="Removable">
  <div class="demo-row">
    {#each tags as tag (tag)}
      <Tag tone="accent" onremove={() => (tags = tags.filter((t) => t !== tag))}>{tag}</Tag>
    {/each}
    {#if tags.length < initial.length}
      <Button variant="ghost" size="sm" onclick={() => (tags = [...initial])}>Reset</Button>
    {/if}
  </div>
</Section>
