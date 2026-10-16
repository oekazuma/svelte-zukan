<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
</script>

<dl>
  <dt>page.url.pathname</dt>
  <dd>{JSON.stringify(page.url.pathname)}</dd>
  <dt>resolve('/')</dt>
  <dd>{JSON.stringify(resolve('/'))}</dd>
</dl>
