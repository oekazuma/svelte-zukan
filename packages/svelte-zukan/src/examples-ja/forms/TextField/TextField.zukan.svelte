<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from '../../Button/Button.svelte';
  import TextField from './TextField.svelte';

  let name = $state('');
  let email = $state('hello@');
  const error = $derived(
    email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? 'name@example.com の形式で入力してください' : undefined
  );
</script>

<Section title="基本">
  <div class="demo-stack demo-narrow">
    <TextField label="表示名" placeholder="田中 愛子" bind:value={name} />
    <p class="demo-note">こんにちは、{name || 'ゲスト'}さん。</p>
  </div>
</Section>

<Section title="補足とアイコン">
  <div class="demo-stack demo-narrow">
    <TextField
      label="検索"
      icon="search"
      placeholder="コンポーネント、ドキュメント…"
      hint="/ キーでここに移動します。"
    />
  </div>
</Section>

<Section title="入力チェック">
  <form class="demo-stack demo-narrow" onsubmit={(e) => e.preventDefault()}>
    <TextField
      label="メールアドレス"
      type="email"
      icon="mail"
      bind:value={email}
      {error}
      hint="第三者に共有することはありません。"
    />
    <div><Button variant="primary" type="submit" disabled={!email || !!error}>登録する</Button></div>
  </form>
</Section>

<Section title="無効">
  <div class="demo-stack demo-narrow">
    <TextField label="ワークスペースの URL" value="acme.example.com" disabled />
  </div>
</Section>
