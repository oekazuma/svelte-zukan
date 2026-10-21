<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from '../Button/Button.svelte';
  import Icon from '../Icon/Icon.svelte';
  import Tooltip from './Tooltip.svelte';
</script>

<Section title="Placement">
  <div class="demo-row demo-tooltips">
    <Tooltip text="Saved 2 minutes ago">
      {#snippet children(attrs)}<Button {...attrs}>Top</Button>{/snippet}
    </Tooltip>
    <Tooltip text="Opens in a new tab" placement="bottom">
      {#snippet children(attrs)}<Button {...attrs}>Bottom</Button>{/snippet}
    </Tooltip>
  </div>
</Section>

<Section title="Icon buttons">
  <div class="demo-row demo-tooltips">
    <Tooltip text="Shortcut: L">
      {#snippet children(attrs)}
        <Button variant="ghost" aria-label="Like" {...attrs}><Icon name="heart" /></Button>
      {/snippet}
    </Tooltip>
    <Tooltip text="Shortcut: S">
      {#snippet children(attrs)}
        <Button variant="ghost" aria-label="Star" {...attrs}><Icon name="star" /></Button>
      {/snippet}
    </Tooltip>
  </div>
</Section>

<style>
  .demo-tooltips {
    padding: 40px 48px;
  }
</style>
