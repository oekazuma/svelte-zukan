<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from '../Button/Button.svelte';
  import Icon from '../Icon/Icon.svelte';
  import Progress from './Progress.svelte';

  let uploaded = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  function upload() {
    uploaded = 0;
    clearInterval(timer);
    timer = setInterval(() => {
      uploaded = Math.min(uploaded + Math.random() * 18, 100);
      if (uploaded === 100) clearInterval(timer);
    }, 250);
  }

  $effect(() => () => clearInterval(timer));
</script>

{#snippet arrow()}
  <Icon name="upload" size={16} />
{/snippet}

<Section title="進み具合">
  <div class="demo-stack">
    <Progress label="プロフィールの入力" value={25} />
    <Progress label="ストレージの使用量" value={92} tone="warning" />
    <Progress label="成功したテスト" value={100} tone="success" />
  </div>
</Section>

<Section title="進み具合が不明">
  <div class="demo-stack">
    <Progress label="エクスポートを準備しています…" />
  </div>
</Section>

<Section title="アップロード">
  <div class="demo-stack">
    <Progress label="design-tokens.zip" value={uploaded} tone={uploaded === 100 ? 'success' : 'accent'} />
    <div>
      <Button variant="primary" icon={arrow} onclick={upload} disabled={uploaded > 0 && uploaded < 100}>
        {uploaded === 100 ? 'もう一度アップロード' : 'アップロード'}
      </Button>
    </div>
  </div>
</Section>
