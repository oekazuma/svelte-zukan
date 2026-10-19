<script lang="ts">
  import { dev } from '$app/env';
</script>

<h1>svelte-zukan</h1>
<p>Colocated component catalog for Svelte, served by a Vite plugin.</p>
{#if dev}
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the catalog is served by the Vite plugin, not by SvelteKit -->
  <p><a href="/__zukan/">Open the catalog</a></p>
{/if}
