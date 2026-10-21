<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Switch from './Switch.svelte';

  let enabled = $state(true);
  let settings = $state({ email: true, push: false, digest: true });
</script>

<Section title="基本">
  <div class="demo-stack">
    <Switch bind:checked={enabled} label="ダークモード" />
    <p class="demo-note">ダークモードは{enabled ? 'オン' : 'オフ'}です。</p>
  </div>
</Section>

<Section title="設定">
  <div class="demo-stack">
    <Switch
      bind:checked={settings.email}
      label="メール"
      description="あなたの作品にコメントが付くたびにお知らせします。"
    />
    <Switch bind:checked={settings.push} label="プッシュ通知" description="この端末に通知します。" />
    <Switch bind:checked={settings.digest} label="週間ダイジェスト" description="毎週月曜の朝にまとめを届けます。" />
  </div>
</Section>

<Section title="無効">
  <div class="demo-stack">
    <Switch label="組織が管理しています" checked disabled />
  </div>
</Section>
