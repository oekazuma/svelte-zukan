<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Pagination from './Pagination.svelte';

  let page = $state(1);
  let results = $state(6);
</script>

<Section title="Basic">
  <div class="demo-stack">
    <Pagination bind:page count={5} />
    <p class="demo-note">Page {page} of 5</p>
  </div>
</Section>

<Section title="Many pages">
  <div class="demo-stack">
    <Pagination bind:page={results} count={20} />
    <p class="demo-note">Showing results {(results - 1) * 10 + 1}–{results * 10} of 200</p>
  </div>
</Section>
