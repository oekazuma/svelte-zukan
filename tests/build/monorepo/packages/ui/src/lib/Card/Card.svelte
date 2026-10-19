<script lang="ts">
  import { label } from '#lib/label.js';

  let { title }: { title: string } = $props();
</script>

<article>{label(title)}</article>

<style>
  article {
    padding: 12px;
    border: 1px solid #d1d9e0;
    border-radius: 6px;
  }
</style>
