<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Switch from './Switch.svelte';

  let enabled = $state(true);
  let settings = $state({ email: true, push: false, digest: true });
</script>

<Section title="Basic">
  <div class="demo-stack">
    <Switch bind:checked={enabled} label="Dark mode" />
    <p class="demo-note">Dark mode is {enabled ? 'on' : 'off'}.</p>
  </div>
</Section>

<Section title="Settings">
  <div class="demo-stack">
    <Switch bind:checked={settings.email} label="Email" description="A message for every comment on your work." />
    <Switch bind:checked={settings.push} label="Push notifications" description="Alerts on this device." />
    <Switch bind:checked={settings.digest} label="Weekly digest" description="A summary every Monday morning." />
  </div>
</Section>

<Section title="Disabled">
  <div class="demo-stack">
    <Switch label="Managed by your organization" checked disabled />
  </div>
</Section>
