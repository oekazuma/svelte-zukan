<script lang="ts">
  import type { WithElementRef } from '$lib/utils.js';
  import type { Labelled } from '#lib/labelled.js';

  let { label, ref = $bindable(null) }: WithElementRef<Labelled> = $props();
</script>

<span bind:this={ref}>{label}</span>
