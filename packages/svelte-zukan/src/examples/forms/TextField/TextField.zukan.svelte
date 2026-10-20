<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from '../../Button/Button.svelte';
  import TextField from './TextField.svelte';

  let name = $state('');
  let email = $state('hello@');
  const error = $derived(
    email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? 'Enter an email like name@example.com' : undefined
  );
</script>

<Section title="Basic">
  <div class="demo-stack demo-narrow">
    <TextField label="Display name" placeholder="Aiko Tanaka" bind:value={name} />
    <p class="demo-note">Hello, {name || 'stranger'}!</p>
  </div>
</Section>

<Section title="Hint and icon">
  <div class="demo-stack demo-narrow">
    <TextField label="Search" icon="search" placeholder="Components, docs…" hint="Press / to jump here." />
  </div>
</Section>

<Section title="Validation">
  <form class="demo-stack demo-narrow" onsubmit={(e) => e.preventDefault()}>
    <TextField label="Email" type="email" icon="mail" bind:value={email} {error} hint="We never share it." />
    <div><Button variant="primary" type="submit" disabled={!email || !!error}>Subscribe</Button></div>
  </form>
</Section>

<Section title="Disabled">
  <div class="demo-stack demo-narrow">
    <TextField label="Workspace URL" value="acme.example.com" disabled />
  </div>
</Section>
