<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from '../Button/Button.svelte';
  import Tag from './Tag.svelte';

  const initial = ['Svelte', 'Vite', 'TypeScript', 'デザインシステム'];
  let tags = $state([...initial]);
</script>

<Section title="色の種類">
  <div class="demo-row">
    <Tag>下書き</Tag>
    <Tag tone="accent">新着</Tag>
    <Tag tone="success">公開中</Tag>
    <Tag tone="warning">レビュー中</Tag>
    <Tag tone="danger">保留</Tag>
  </div>
</Section>

<Section title="削除できるタグ">
  <div class="demo-row">
    {#each tags as tag (tag)}
      <Tag tone="accent" onremove={() => (tags = tags.filter((t) => t !== tag))}>{tag}</Tag>
    {/each}
    {#if tags.length < initial.length}
      <Button variant="ghost" size="sm" onclick={() => (tags = [...initial])}>元に戻す</Button>
    {/if}
  </div>
</Section>
