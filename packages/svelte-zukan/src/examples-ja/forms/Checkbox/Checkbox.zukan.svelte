<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Checkbox from './Checkbox.svelte';

  let terms = $state(false);
  let toppings = $state({ cheese: true, basil: false, olives: false });
  const count = $derived(Object.values(toppings).filter(Boolean).length);
  const all = $derived(count === 3);
  const some = $derived(count > 0 && count < 3);

  function setAll(value: boolean) {
    toppings = { cheese: value, basil: value, olives: value };
  }
</script>

<Section title="基本">
  <div class="demo-stack">
    <Checkbox bind:checked={terms} label="利用規約に同意する" />
    <p class="demo-note">{terms ? 'ありがとうございます。' : '続けるにはチェックを入れてください。'}</p>
  </div>
</Section>

<Section title="すべて選択">
  <div class="demo-stack">
    <Checkbox bind:checked={() => all, setAll} indeterminate={some} label="トッピングをすべて選ぶ" />
    <div class="demo-stack demo-indent">
      <Checkbox bind:checked={toppings.cheese} label="チーズ" />
      <Checkbox bind:checked={toppings.basil} label="バジル" description="菜園で摘んだばかりです。" />
      <Checkbox bind:checked={toppings.olives} label="オリーブ" />
    </div>
  </div>
</Section>

<Section title="無効">
  <div class="demo-stack">
    <Checkbox label="ご利用のプランでは必須です" checked disabled />
  </div>
</Section>

<style>
  .demo-indent {
    padding-left: 28px;
  }
</style>
