<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Select from './Select.svelte';

  const languages = [
    { value: 'en', label: '英語' },
    { value: 'ja', label: '日本語' },
    { value: 'fr', label: 'フランス語' }
  ];
  const regions = [
    { value: 'tokyo', label: '東京' },
    { value: 'osaka', label: '大阪' },
    { value: 'frankfurt', label: 'フランクフルト' },
    { value: 'virginia', label: 'バージニア' }
  ];

  let language = $state('en');
  let region = $state('');
</script>

<Section title="基本">
  <div class="demo-stack demo-narrow">
    <Select label="言語" options={languages} bind:value={language} />
    <p class="demo-note">選択中: {language}</p>
  </div>
</Section>

<Section title="プレースホルダーと補足">
  <div class="demo-stack demo-narrow">
    <Select
      label="リージョン"
      options={regions}
      bind:value={region}
      placeholder="リージョンを選択"
      hint="ユーザーにいちばん近いものを選んでください。"
    />
  </div>
</Section>

<Section title="無効">
  <div class="demo-stack demo-narrow">
    <Select label="プラン" options={[{ value: 'team', label: 'チーム' }]} value="team" disabled />
  </div>
</Section>
