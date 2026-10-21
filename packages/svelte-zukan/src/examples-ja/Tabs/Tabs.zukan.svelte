<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Tabs from './Tabs.svelte';

  let plan = $state('monthly');
</script>

{#snippet overview()}
  <p>コンポーネント、説明、プレビューを、コードの隣の 1 か所にまとめます。</p>
{/snippet}

{#snippet usage()}
  <p>
    <code>Button.svelte</code> の隣に <code>Button.zukan.svelte</code> を置いて、<code>/__zukan/</code> を開きます。
  </p>
{/snippet}

{#snippet faq()}
  <p>矢印キー、Home、End でタブを移動できます。</p>
{/snippet}

{#snippet monthly()}
  <p>月額 <strong class="demo-price">¥980</strong>。いつでも解約できます。</p>
{/snippet}

{#snippet yearly()}
  <p>年額 <strong class="demo-price">¥9,800</strong>。2 か月分お得です。</p>
{/snippet}

<Section title="下線">
  <Tabs
    items={[
      { id: 'overview', label: '概要', panel: overview },
      { id: 'usage', label: '使い方', panel: usage },
      { id: 'faq', label: 'キーボード', panel: faq }
    ]}
  />
</Section>

<Section title="ピル">
  <Tabs
    variant="pills"
    bind:selected={plan}
    items={[
      { id: 'monthly', label: '月払い', panel: monthly },
      { id: 'yearly', label: '年払い', panel: yearly }
    ]}
  />
  <p class="demo-note">選択中: {plan}</p>
</Section>
