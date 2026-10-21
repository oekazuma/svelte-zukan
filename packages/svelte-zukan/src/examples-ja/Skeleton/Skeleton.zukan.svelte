<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Avatar from '../Avatar/Avatar.svelte';
  import Button from '../Button/Button.svelte';
  import Skeleton from './Skeleton.svelte';

  let loading = $state(true);
</script>

<Section title="形">
  <div class="demo-stack">
    <Skeleton lines={3} />
    <Skeleton shape="rect" />
    <div class="demo-row">
      <Skeleton shape="circle" />
      <Skeleton shape="circle" width="56px" />
    </div>
  </div>
</Section>

<Section title="プロフィールの読み込み">
  <div class="demo-stack demo-narrow">
    <div class="demo-row">
      {#if loading}
        <Skeleton shape="circle" width="48px" />
        <div class="demo-spacer"><Skeleton lines={2} /></div>
      {:else}
        <Avatar name="田中 愛子" size="lg" />
        <div class="demo-spacer">
          <strong>田中 愛子</strong>
          <p class="demo-note">デザインシステム担当・東京</p>
        </div>
      {/if}
    </div>
    <div>
      <Button size="sm" onclick={() => (loading = !loading)}>{loading ? '読み込みを完了' : 'もう一度読み込む'}</Button>
    </div>
  </div>
</Section>
