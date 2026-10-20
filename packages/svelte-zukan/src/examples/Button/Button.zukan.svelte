<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Icon from '../Icon/Icon.svelte';
  import Button from './Button.svelte';

  let count = $state(0);
  const label = $derived(count === 0 ? 'Like' : `${count} likes`);

  let saving = $state(false);
  function save() {
    saving = true;
    setTimeout(() => (saving = false), 1500);
  }
</script>

{#snippet heart()}
  <Icon name="heart" size={16} />
{/snippet}

<Section title="Variants">
  <div class="demo-row">
    <Button variant="primary">Primary</Button>
    <Button>Secondary</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="danger">Delete</Button>
  </div>
</Section>

<Section title="Sizes">
  <div class="demo-row">
    <Button variant="primary" size="sm">Small</Button>
    <Button variant="primary">Medium</Button>
    <Button variant="primary" size="lg">Large</Button>
  </div>
</Section>

<Section title="With an icon">
  <div class="demo-row">
    <Button icon={heart} onclick={() => count++}>{label}</Button>
    <Button variant="ghost" size="sm" onclick={() => (count = 0)} disabled={count === 0}>Reset</Button>
  </div>
</Section>

<Section title="Loading">
  <Button variant="primary" loading={saving} onclick={save}>{saving ? 'Saving…' : 'Save changes'}</Button>
</Section>

<Section title="Disabled">
  <div class="demo-row">
    <Button variant="primary" disabled>Primary</Button>
    <Button disabled>Secondary</Button>
  </div>
</Section>
