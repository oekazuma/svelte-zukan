<script lang="ts">
  import { resolve } from '$app/paths';
</script>

<h1>svelte-zukan</h1>
<a href={resolve('/zukan/[...path]', { path: '' })}>カタログを開く</a>
