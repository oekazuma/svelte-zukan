<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Pagination from './Pagination.svelte';

  let page = $state(1);
  let results = $state(6);
</script>

<Section title="基本">
  <div class="demo-stack">
    <Pagination bind:page count={5} />
    <p class="demo-note">5 ページ中 {page} ページ目</p>
  </div>
</Section>

<Section title="ページが多い場合">
  <div class="demo-stack">
    <Pagination bind:page={results} count={20} />
    <p class="demo-note">200 件中 {(results - 1) * 10 + 1}–{results * 10} 件目を表示</p>
  </div>
</Section>
