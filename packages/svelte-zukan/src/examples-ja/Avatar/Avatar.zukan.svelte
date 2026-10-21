<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Avatar from './Avatar.svelte';
  import AvatarGroup from './AvatarGroup.svelte';

  const team = ['田中 愛子', 'Ben Carter', 'Chloé Martin', 'Daniel Okafor', '佐藤 恵美', 'Felix Wagner', 'Grace Liu'];
</script>

<Section title="サイズ">
  <div class="demo-row">
    <Avatar name="田中 愛子" size="sm" />
    <Avatar name="田中 愛子" />
    <Avatar name="田中 愛子" size="lg" />
    <Avatar name="田中 愛子" size="xl" />
  </div>
</Section>

<Section title="状態">
  <div class="demo-row">
    <Avatar name="Ben Carter" size="lg" status="online" />
    <Avatar name="Chloé Martin" size="lg" status="away" />
    <Avatar name="Daniel Okafor" size="lg" status="offline" />
  </div>
</Section>

<Section title="グループ">
  <div class="demo-row">
    <AvatarGroup names={team} />
    <span class="demo-note">{team.length} 人がこのファイルを編集中です</span>
  </div>
</Section>
