<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from '../Button/Button.svelte';
  import Alert from './Alert.svelte';

  let visible = $state(true);
</script>

<Section title="Tones">
  <div class="demo-stack">
    <Alert title="A new version is available">Reload the page to get the latest catalog.</Alert>
    <Alert tone="success" title="Changes saved">Your profile was updated.</Alert>
    <Alert tone="warning" title="Storage almost full">You have used 92% of your quota.</Alert>
    <Alert tone="danger" title="Payment failed">The card was declined. Try another one.</Alert>
  </div>
</Section>

<Section title="With actions">
  <div class="demo-stack">
    <Alert tone="warning" title="Your trial ends in 3 days">
      Pick a plan to keep your projects.
      {#snippet actions()}
        <Button variant="primary" size="sm">Choose a plan</Button>
        <Button variant="ghost" size="sm">Remind me later</Button>
      {/snippet}
    </Alert>
  </div>
</Section>

<Section title="Dismissible">
  <div class="demo-stack">
    {#if visible}
      <Alert tone="success" title="Welcome aboard" ondismiss={() => (visible = false)}>
        Close this message with the button on the right.
      </Alert>
    {:else}
      <div><Button size="sm" onclick={() => (visible = true)}>Show the message again</Button></div>
    {/if}
  </div>
</Section>
