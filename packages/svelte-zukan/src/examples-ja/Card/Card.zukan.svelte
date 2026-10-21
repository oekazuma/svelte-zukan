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

<Section title="商品">
  <div class="demo-grid">
    <Card title="オーロラ デスクライト" eyebrow="照明" cover="linear-gradient(135deg, #6d4aff, #ff7ab6)">
      <p>タッチ操作で明るさを変えられる、あたたかい光。2 日で発送します。</p>
      {#snippet footer()}
        <strong class="demo-price">¥12,800</strong>
        <Tag tone="success">在庫あり</Tag>
        <span class="demo-spacer"></span>
        <Button variant={saved ? 'secondary' : 'primary'} size="sm" onclick={() => (saved = !saved)}>
          {saved ? '保存済み' : '保存'}
        </Button>
      {/snippet}
    </Card>
    <Card title="タイド ウォールクロック" eyebrow="インテリア" cover="linear-gradient(135deg, #0ea5e9, #34d399)">
      <p>音のしないスイープ運針と、潮の満ち引きがわかる文字盤。</p>
      {#snippet footer()}
        <strong class="demo-price">¥8,400</strong>
        <Tag tone="warning">残り 3 点</Tag>
      {/snippet}
    </Card>
  </div>
</Section>

<Section title="プロフィール">
  <div class="demo-narrow">
    <Card title="田中 愛子" eyebrow="デザインリード">
      <div class="demo-row">
        <Avatar name="田中 愛子" size="lg" status="online" />
        <span><Icon name="mail" size={16} /> aiko@example.com</span>
      </div>
      <p>デザインシステムを作り、チームをまたいでコンポーネントの一貫性を保っています。</p>
      {#snippet footer()}
        <Button variant={following ? 'secondary' : 'primary'} onclick={() => (following = !following)}>
          {following ? 'フォロー中' : 'フォロー'}
        </Button>
        <Button variant="ghost">メッセージ</Button>
      {/snippet}
    </Card>
  </div>
</Section>

<Section title="レスポンシブ">
  <Card
    horizontal
    title="コンポーネントの隣に置いたカタログが古くならない理由"
    eyebrow="記事 · 6 分で読めます"
    cover="linear-gradient(160deg, #f59e0b, #ef4444 60%, #7c3aed)"
  >
    <p>
      コンポーネントの隣にある例は、同じプルリクエストで一緒に直されます。プレビューの幅を 375
      に切り替えると、このカードのカバーが上に積まれます。
    </p>
    {#snippet footer()}
      <Tag tone="accent">Svelte</Tag>
      <Tag>ツール</Tag>
    {/snippet}
  </Card>
</Section>
