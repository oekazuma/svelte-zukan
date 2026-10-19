<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  // pulls in Kit's client runtime, which reads __SVELTEKIT_HAS_SERVER_LOAD__ and __SVELTEKIT_HAS_UNIVERSAL_LOAD__
  import { goto } from '$app/navigation';
</script>

<dl>
  <dt>page.url.pathname</dt>
  <dd>{JSON.stringify(page.url.pathname)}</dd>
</dl>
<button onclick={() => goto(resolve('/')).catch(() => {})}>goto('/')</button>
