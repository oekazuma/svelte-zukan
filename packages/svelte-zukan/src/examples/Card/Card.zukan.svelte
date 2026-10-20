<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Avatar from '../Avatar/Avatar.svelte';
  import Button from '../Button/Button.svelte';
  import Icon from '../Icon/Icon.svelte';
  import Tag from '../Tag/Tag.svelte';
  import Card from './Card.svelte';

  let saved = $state(false);
  let following = $state(false);
</script>

<Section title="Product">
  <div class="demo-grid">
    <Card title="Aurora desk lamp" eyebrow="Lighting" cover="linear-gradient(135deg, #6d4aff, #ff7ab6)">
      <p>Warm, dimmable light with a touch strip. Ships in two days.</p>
      {#snippet footer()}
        <strong class="demo-price">¥12,800</strong>
        <Tag tone="success">In stock</Tag>
        <span class="demo-spacer"></span>
        <Button variant={saved ? 'secondary' : 'primary'} size="sm" onclick={() => (saved = !saved)}>
          {saved ? 'Saved' : 'Save'}
        </Button>
      {/snippet}
    </Card>
    <Card title="Tide wall clock" eyebrow="Home" cover="linear-gradient(135deg, #0ea5e9, #34d399)">
      <p>A silent sweep movement and a face that reads the tides.</p>
      {#snippet footer()}
        <strong class="demo-price">¥8,400</strong>
        <Tag tone="warning">3 left</Tag>
      {/snippet}
    </Card>
  </div>
</Section>

<Section title="Profile">
  <div class="demo-narrow">
    <Card title="Aiko Tanaka" eyebrow="Design lead">
      <div class="demo-row">
        <Avatar name="Aiko Tanaka" size="lg" status="online" />
        <span><Icon name="mail" size={16} /> aiko@example.com</span>
      </div>
      <p>Builds the design system and keeps the components consistent across teams.</p>
      {#snippet footer()}
        <Button variant={following ? 'secondary' : 'primary'} onclick={() => (following = !following)}>
          {following ? 'Following' : 'Follow'}
        </Button>
        <Button variant="ghost">Message</Button>
      {/snippet}
    </Card>
  </div>
</Section>

<Section title="Responsive">
  <Card
    horizontal
    title="Why colocated catalogs stay up to date"
    eyebrow="Article · 6 min read"
    cover="linear-gradient(160deg, #f59e0b, #ef4444 60%, #7c3aed)"
  >
    <p>
      Examples that live next to the component are edited in the same pull request. Switch the preview width to 375 to
      see this card stack its cover on top.
    </p>
    {#snippet footer()}
      <Tag tone="accent">Svelte</Tag>
      <Tag>Tooling</Tag>
    {/snippet}
  </Card>
</Section>
