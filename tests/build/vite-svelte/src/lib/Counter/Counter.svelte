<script lang="ts">
  let count = $state(0);
</script>

<button onclick={() => count++}>count: {count}</button>

<style>
  button {
    color: light-dark(#000, #fff);
  }
</style>
