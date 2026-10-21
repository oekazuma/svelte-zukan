<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Select from './Select.svelte';

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'fr', label: 'Français' }
  ];
  const regions = [
    { value: 'tokyo', label: 'Tokyo' },
    { value: 'osaka', label: 'Osaka' },
    { value: 'frankfurt', label: 'Frankfurt' },
    { value: 'virginia', label: 'Virginia' }
  ];

  let language = $state('en');
  let region = $state('');
</script>

<Section title="Basic">
  <div class="demo-stack demo-narrow">
    <Select label="Language" options={languages} bind:value={language} />
    <p class="demo-note">Selected: {language}</p>
  </div>
</Section>

<Section title="Placeholder and hint">
  <div class="demo-stack demo-narrow">
    <Select
      label="Region"
      options={regions}
      bind:value={region}
      placeholder="Pick a region"
      hint="Choose the one closest to your users."
    />
  </div>
</Section>

<Section title="Disabled">
  <div class="demo-stack demo-narrow">
    <Select label="Plan" options={[{ value: 'team', label: 'Team' }]} value="team" disabled />
  </div>
</Section>
