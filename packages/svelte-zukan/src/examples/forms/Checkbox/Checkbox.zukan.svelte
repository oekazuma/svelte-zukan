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

<Section title="Basic">
  <div class="demo-stack">
    <Checkbox bind:checked={terms} label="I agree to the terms" />
    <p class="demo-note">{terms ? 'Thanks!' : 'Check the box to continue.'}</p>
  </div>
</Section>

<Section title="Select all">
  <div class="demo-stack">
    <Checkbox bind:checked={() => all, setAll} indeterminate={some} label="All toppings" />
    <div class="demo-stack demo-indent">
      <Checkbox bind:checked={toppings.cheese} label="Cheese" />
      <Checkbox bind:checked={toppings.basil} label="Basil" description="Fresh from the garden." />
      <Checkbox bind:checked={toppings.olives} label="Olives" />
    </div>
  </div>
</Section>

<Section title="Disabled">
  <div class="demo-stack">
    <Checkbox label="Required by your plan" checked disabled />
  </div>
</Section>

<style>
  .demo-indent {
    padding-left: 28px;
  }
</style>
