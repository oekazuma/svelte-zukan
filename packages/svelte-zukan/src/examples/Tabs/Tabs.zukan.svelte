<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Tabs from './Tabs.svelte';

  let plan = $state('monthly');
</script>

{#snippet overview()}
  <p>Components, docs and previews in one place, next to your code.</p>
{/snippet}

{#snippet usage()}
  <p>Put <code>Button.zukan.svelte</code> next to <code>Button.svelte</code> and open <code>/__zukan/</code>.</p>
{/snippet}

{#snippet faq()}
  <p>Use the arrow keys, Home and End to move between tabs.</p>
{/snippet}

{#snippet monthly()}
  <p><strong class="demo-price">¥980</strong> per month, cancel anytime.</p>
{/snippet}

{#snippet yearly()}
  <p><strong class="demo-price">¥9,800</strong> per year, two months free.</p>
{/snippet}

<Section title="Underline">
  <Tabs
    items={[
      { id: 'overview', label: 'Overview', panel: overview },
      { id: 'usage', label: 'Usage', panel: usage },
      { id: 'faq', label: 'Keyboard', panel: faq }
    ]}
  />
</Section>

<Section title="Pills">
  <Tabs
    variant="pills"
    bind:selected={plan}
    items={[
      { id: 'monthly', label: 'Monthly', panel: monthly },
      { id: 'yearly', label: 'Yearly', panel: yearly }
    ]}
  />
  <p class="demo-note">Selected: {plan}</p>
</Section>
