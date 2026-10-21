<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from '../Button/Button.svelte';
  import Dialog from './Dialog.svelte';

  let confirmOpen = $state(false);
  let infoOpen = $state(false);
  let deleted = $state(false);
</script>

<Section title="Confirm">
  <div class="demo-stack demo-dialog">
    <div>
      <Button variant="danger" onclick={() => (confirmOpen = true)} disabled={deleted}>Delete project</Button>
    </div>
    <p class="demo-note">
      {deleted ? 'The project was deleted.' : 'Opens a modal; Escape or a click outside closes it.'}
    </p>
    <Dialog bind:open={confirmOpen} title="Delete this project?">
      Its components and history are removed for everyone. This cannot be undone.
      {#snippet actions()}
        <Button variant="ghost" onclick={() => (confirmOpen = false)}>Cancel</Button>
        <Button
          variant="danger"
          onclick={() => {
            deleted = true;
            confirmOpen = false;
          }}>Delete</Button
        >
      {/snippet}
    </Dialog>
  </div>
</Section>

<Section title="Message only">
  <div class="demo-stack demo-dialog">
    <div><Button onclick={() => (infoOpen = true)}>What's new</Button></div>
    <Dialog bind:open={infoOpen} title="What's new in 2.0">
      Catalog files now support Markdown docs, a props table and an accessibility check for every section.
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
