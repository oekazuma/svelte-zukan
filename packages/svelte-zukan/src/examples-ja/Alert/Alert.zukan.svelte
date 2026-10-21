<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from '../Button/Button.svelte';
  import Alert from './Alert.svelte';

  let visible = $state(true);
</script>

<Section title="トーン">
  <div class="demo-stack">
    <Alert title="新しいバージョンがあります">ページを再読み込みすると、最新のカタログが表示されます。</Alert>
    <Alert tone="success" title="変更を保存しました">プロフィールを更新しました。</Alert>
    <Alert tone="warning" title="ストレージの空きがわずかです">割り当て容量の 92% を使用しています。</Alert>
    <Alert tone="danger" title="お支払いに失敗しました"
      >カードが承認されませんでした。別のカードをお試しください。</Alert
    >
  </div>
</Section>

<Section title="アクション付き">
  <div class="demo-stack">
    <Alert tone="warning" title="無料トライアルは残り 3 日です">
      プロジェクトを残すには、プランを選んでください。
      {#snippet actions()}
        <Button variant="primary" size="sm">プランを選ぶ</Button>
        <Button variant="ghost" size="sm">あとで通知する</Button>
      {/snippet}
    </Alert>
  </div>
</Section>

<Section title="閉じられるアラート">
  <div class="demo-stack">
    {#if visible}
      <Alert tone="success" title="ようこそ" ondismiss={() => (visible = false)}>
        右のボタンでこのメッセージを閉じられます。
      </Alert>
    {:else}
      <div><Button size="sm" onclick={() => (visible = true)}>メッセージをもう一度表示</Button></div>
    {/if}
  </div>
</Section>
