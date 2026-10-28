<script lang="ts">
  import { assets, immutable, prerendered, routes } from '$app/manifest';
</script>

<output>{JSON.stringify([assets, immutable, prerendered, routes].map((list) => list.length))}</output>
