<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Icon from '../../Icon/Icon.svelte';
  import Button from '../../Button/Button.svelte';

  const pages = [1, 2, 3, 4, 5];
  let current = $state(1);
</script>

{#snippet back()}
  <Icon name="arrow-left" size={16} />
{/snippet}

<Section title="Pagination">
  <nav class="demo-row" aria-label="Pagination">
    <Button variant="ghost" icon={back} disabled={current === 1} onclick={() => current--}>Previous</Button>
    {#each pages as page (page)}
      <Button
        size="sm"
        variant={page === current ? 'primary' : 'secondary'}
        aria-current={page === current ? 'page' : undefined}
        onclick={() => (current = page)}>{page}</Button
      >
    {/each}
    <Button variant="ghost" disabled={current === pages.length} onclick={() => current++}>
      Next <Icon name="arrow-right" size={16} />
    </Button>
  </nav>
</Section>
