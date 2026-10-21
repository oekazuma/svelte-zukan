<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from '../Button/Button.svelte';
  import Icon from '../Icon/Icon.svelte';
  import Tooltip from './Tooltip.svelte';
</script>

<Section title="表示位置">
  <div class="demo-row demo-tooltips">
    <Tooltip text="2 分前に保存しました">
      {#snippet children(attrs)}<Button {...attrs}>上</Button>{/snippet}
    </Tooltip>
    <Tooltip text="新しいタブで開きます" placement="bottom">
      {#snippet children(attrs)}<Button {...attrs}>下</Button>{/snippet}
    </Tooltip>
  </div>
</Section>

<Section title="アイコンボタン">
  <div class="demo-row demo-tooltips">
    <Tooltip text="ショートカット：L">
      {#snippet children(attrs)}
        <Button variant="ghost" aria-label="いいね" {...attrs}><Icon name="heart" /></Button>
      {/snippet}
    </Tooltip>
    <Tooltip text="ショートカット：S">
      {#snippet children(attrs)}
        <Button variant="ghost" aria-label="スター" {...attrs}><Icon name="star" /></Button>
      {/snippet}
    </Tooltip>
  </div>
</Section>

<style>
  .demo-tooltips {
    padding: 40px 48px;
  }
</style>
