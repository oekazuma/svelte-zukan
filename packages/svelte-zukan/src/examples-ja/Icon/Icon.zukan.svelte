<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Icon, { ICONS, type IconName } from './Icon.svelte';

  const names = Object.keys(ICONS) as IconName[];
</script>

<Section title="すべてのアイコン">
  <div class="demo-icons">
    {#each names as name (name)}
      <figure>
        <Icon {name} size={22} />
        <figcaption>{name}</figcaption>
      </figure>
    {/each}
  </div>
</Section>

<Section title="サイズと色">
  <div class="demo-row" style="color: var(--ex-accent)">
    <Icon name="star" size={14} />
    <Icon name="star" size={18} />
    <Icon name="star" size={24} />
    <Icon name="star" size={32} />
    <span style="color: var(--ex-danger)"><Icon name="heart" size={32} label="お気に入り" /></span>
  </div>
</Section>
