<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Breadcrumb from './Breadcrumb.svelte';
</script>

<!-- the preview routes by hash, so following a demo link would leave the preview -->
<svelte:window onclick={(e) => (e.target as Element).closest('a') && e.preventDefault()} />

<Section title="Basic">
  <Breadcrumb
    items={[{ label: 'Home', href: '#home' }, { label: 'Components', href: '#components' }, { label: 'Breadcrumb' }]}
  />
</Section>

<Section title="Deep">
  <div class="demo-narrow">
    <Breadcrumb
      items={[
        { label: 'Acme', href: '#acme' },
        { label: 'Projects', href: '#projects' },
        { label: 'Design system', href: '#design-system' },
        { label: 'Tokens', href: '#tokens' },
        { label: 'Color palette' }
      ]}
    />
  </div>
</Section>
