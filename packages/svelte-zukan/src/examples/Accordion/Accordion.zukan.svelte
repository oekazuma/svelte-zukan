<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Accordion from './Accordion.svelte';

  let open = $state(true);
</script>

<Section title="Basic">
  <div class="demo-stack">
    <div>
      <Accordion title="What is a catalog file?" bind:open>
        A <code>.zukan.svelte</code> file next to a component, with one <code>&lt;Section&gt;</code> per example.
      </Accordion>
      <Accordion title="Does it need a config file?">No. Add the Vite plugin and open <code>/__zukan/</code>.</Accordion
      >
    </div>
    <p class="demo-note">The first item is {open ? 'open' : 'closed'}.</p>
  </div>
</Section>

<Section title="One at a time">
  <div class="demo-stack">
    <div>
      <Accordion name="faq" title="Shipping" open>Orders leave the warehouse within two business days.</Accordion>
      <Accordion name="faq" title="Returns">Send it back within 30 days for a full refund.</Accordion>
      <Accordion name="faq" title="Warranty">Every product comes with a two-year warranty.</Accordion>
    </div>
  </div>
</Section>
