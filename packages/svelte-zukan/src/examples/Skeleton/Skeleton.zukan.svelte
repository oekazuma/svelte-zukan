<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Avatar from '../Avatar/Avatar.svelte';
  import Button from '../Button/Button.svelte';
  import Skeleton from './Skeleton.svelte';

  let loading = $state(true);
</script>

<Section title="Shapes">
  <div class="demo-stack">
    <Skeleton lines={3} />
    <Skeleton shape="rect" />
    <div class="demo-row">
      <Skeleton shape="circle" />
      <Skeleton shape="circle" width="56px" />
    </div>
  </div>
</Section>

<Section title="Loading a profile">
  <div class="demo-stack demo-narrow">
    <div class="demo-row">
      {#if loading}
        <Skeleton shape="circle" width="48px" />
        <div class="demo-spacer"><Skeleton lines={2} /></div>
      {:else}
        <Avatar name="Aiko Tanaka" size="lg" />
        <div class="demo-spacer">
          <strong>Aiko Tanaka</strong>
          <p class="demo-note">Design systems, Tokyo</p>
        </div>
      {/if}
    </div>
    <div>
      <Button size="sm" onclick={() => (loading = !loading)}>{loading ? 'Finish loading' : 'Load again'}</Button>
    </div>
  </div>
</Section>
