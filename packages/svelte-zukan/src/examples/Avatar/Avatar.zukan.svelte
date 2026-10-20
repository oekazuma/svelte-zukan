<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Avatar from './Avatar.svelte';
  import AvatarGroup from './AvatarGroup.svelte';

  const team = ['Aiko Tanaka', 'Ben Carter', 'Chloé Martin', 'Daniel Okafor', 'Emi Sato', 'Felix Wagner', 'Grace Liu'];
</script>

<Section title="Sizes">
  <div class="demo-row">
    <Avatar name="Aiko Tanaka" size="sm" />
    <Avatar name="Aiko Tanaka" />
    <Avatar name="Aiko Tanaka" size="lg" />
    <Avatar name="Aiko Tanaka" size="xl" />
  </div>
</Section>

<Section title="Status">
  <div class="demo-row">
    <Avatar name="Ben Carter" size="lg" status="online" />
    <Avatar name="Chloé Martin" size="lg" status="away" />
    <Avatar name="Daniel Okafor" size="lg" status="offline" />
  </div>
</Section>

<Section title="Group">
  <div class="demo-row">
    <AvatarGroup names={team} />
    <span class="demo-note">{team.length} people are editing this file</span>
  </div>
</Section>
