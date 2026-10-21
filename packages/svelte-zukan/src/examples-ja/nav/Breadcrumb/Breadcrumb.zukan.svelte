<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Breadcrumb from './Breadcrumb.svelte';
</script>

<!-- the preview routes by hash, so following a demo link would leave the preview -->
<svelte:window onclick={(e) => (e.target as Element).closest('a') && e.preventDefault()} />

<Section title="基本">
  <Breadcrumb
    items={[
      { label: 'ホーム', href: '#home' },
      { label: 'コンポーネント', href: '#components' },
      { label: 'パンくずリスト' }
    ]}
  />
</Section>

<Section title="深い階層">
  <div class="demo-narrow">
    <Breadcrumb
      items={[
        { label: 'Acme', href: '#acme' },
        { label: 'プロジェクト', href: '#projects' },
        { label: 'デザインシステム', href: '#design-system' },
        { label: 'トークン', href: '#tokens' },
        { label: 'カラーパレット' }
      ]}
    />
  </div>
</Section>
