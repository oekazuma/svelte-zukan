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

<Section title="Values">
  <div class="demo-stack">
    <Progress label="Profile completed" value={25} />
    <Progress label="Storage used" value={92} tone="warning" />
    <Progress label="Tests passed" value={100} tone="success" />
  </div>
</Section>

<Section title="Indeterminate">
  <div class="demo-stack">
    <Progress label="Preparing the export…" />
  </div>
</Section>

<Section title="Upload">
  <div class="demo-stack">
    <Progress label="design-tokens.zip" value={uploaded} tone={uploaded === 100 ? 'success' : 'accent'} />
    <div>
      <Button variant="primary" icon={arrow} onclick={upload} disabled={uploaded > 0 && uploaded < 100}>
        {uploaded === 100 ? 'Upload again' : 'Upload'}
      </Button>
    </div>
  </div>
</Section>
