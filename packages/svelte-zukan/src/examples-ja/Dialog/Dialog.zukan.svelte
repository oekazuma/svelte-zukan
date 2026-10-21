<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from '../Button/Button.svelte';
  import Dialog from './Dialog.svelte';

  let confirmOpen = $state(false);
  let infoOpen = $state(false);
  let deleted = $state(false);
</script>

<Section title="確認">
  <div class="demo-stack demo-dialog">
    <div>
      <Button variant="danger" onclick={() => (confirmOpen = true)} disabled={deleted}>プロジェクトを削除</Button>
    </div>
    <p class="demo-note">
      {deleted ? 'プロジェクトを削除しました。' : 'モーダルを開きます。Escape キーか外側のクリックで閉じます。'}
    </p>
    <Dialog bind:open={confirmOpen} title="このプロジェクトを削除しますか？">
      コンポーネントと履歴が削除され、どのメンバーも見られなくなります。この操作は取り消せません。
      {#snippet actions()}
        <Button variant="ghost" onclick={() => (confirmOpen = false)}>キャンセル</Button>
        <Button
          variant="danger"
          onclick={() => {
            deleted = true;
            confirmOpen = false;
          }}>削除</Button
        >
      {/snippet}
    </Dialog>
  </div>
</Section>

<Section title="メッセージのみ">
  <div class="demo-stack demo-dialog">
    <div><Button onclick={() => (infoOpen = true)}>新機能</Button></div>
    <Dialog bind:open={infoOpen} title="2.0 の新機能">
      カタログファイルで、Markdown のドキュメント、Props
      の一覧、セクションごとのアクセシビリティチェックが使えるようになりました。
    </Dialog>
  </div>
</Section>

<style>
  /* the preview grows with its content, and a modal in the top layer adds no height */
  .demo-dialog {
    align-content: start;
    min-height: 260px;
  }
</style>
