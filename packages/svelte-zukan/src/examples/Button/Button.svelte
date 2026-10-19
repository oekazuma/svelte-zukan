<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  let { children, ...rest }: HTMLButtonAttributes = $props();
</script>

<button {...rest}>{@render children?.()}</button>

<style>
  button {
    padding: 6px 14px;
    /* light-dark() follows the catalog's preview background switch */
    border: 1px solid light-dark(#d1d9e0, #3d444d);
    border-radius: 6px;
    background: light-dark(#f6f8fa, #212830);
    color: light-dark(#1f2328, #f0f6fc);
    font: inherit;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
