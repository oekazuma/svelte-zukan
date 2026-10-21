<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Accordion from './Accordion.svelte';

  let open = $state(true);
</script>

<Section title="基本">
  <div class="demo-stack">
    <div>
      <Accordion title="カタログファイルとは？" bind:open>
        コンポーネントの隣に置く <code>.zukan.svelte</code> ファイルです。例ごとに <code>&lt;Section&gt;</code> を 1 つ書きます。
      </Accordion>
      <Accordion title="設定ファイルは必要？"
        >いりません。Vite プラグインを追加して <code>/__zukan/</code> を開くだけです。</Accordion
      >
    </div>
    <p class="demo-note">最初の項目は{open ? '開いています' : '閉じています'}。</p>
  </div>
</Section>

<Section title="1 つだけ開く">
  <div class="demo-stack">
    <div>
      <Accordion name="faq" title="配送" open>ご注文の商品は 2 営業日以内に倉庫から発送します。</Accordion>
      <Accordion name="faq" title="返品">30 日以内に返送いただければ、全額を返金します。</Accordion>
      <Accordion name="faq" title="保証">すべての製品に 2 年間の保証が付いています。</Accordion>
    </div>
  </div>
</Section>
