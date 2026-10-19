<script lang="ts">
  import { dev } from '$app/env';
  import Counter from '../lib/Counter/Counter.svelte';
</script>

<h1>svelte-zukan example</h1>
<Counter />
{#if dev}
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the catalog is served by the Vite plugin, not by SvelteKit -->
  <p><a href="/__zukan/">Open the catalog</a></p>
{/if}
