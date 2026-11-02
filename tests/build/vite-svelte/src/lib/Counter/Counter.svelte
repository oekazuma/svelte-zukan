<script lang="ts">
  import icon from '/icon.svg?url';

  let count = $state(0);
</script>

<button onclick={() => count++}><img src={icon} alt="" />count: {count}</button>

<style>
  button {
    color: light-dark(#000, #fff);
  }

  img {
    background: url('/bg.svg');
  }
</style>
