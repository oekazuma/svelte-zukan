<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Icon from '../Icon/Icon.svelte';
  import Button from './Button.svelte';

  let count = $state(0);
  const label = $derived(count === 0 ? 'いいね' : `いいね ${count}`);

  let saving = $state(false);
  function save() {
    saving = true;
    setTimeout(() => (saving = false), 1500);
  }
</script>

{#snippet heart()}
  <Icon name="heart" size={16} />
{/snippet}

<Section title="バリエーション">
  <div class="demo-row">
    <Button variant="primary">プライマリー</Button>
    <Button>セカンダリー</Button>
    <Button variant="ghost">ゴースト</Button>
    <Button variant="danger">削除</Button>
  </div>
</Section>

<Section title="サイズ">
  <div class="demo-row">
    <Button variant="primary" size="sm">小</Button>
    <Button variant="primary">中</Button>
    <Button variant="primary" size="lg">大</Button>
  </div>
</Section>

<Section title="アイコン付き">
  <div class="demo-row">
    <Button icon={heart} onclick={() => count++}>{label}</Button>
    <Button variant="ghost" size="sm" onclick={() => (count = 0)} disabled={count === 0}>リセット</Button>
  </div>
</Section>

<Section title="読み込み中">
  <Button variant="primary" loading={saving} onclick={save}>{saving ? '保存中…' : '変更を保存'}</Button>
</Section>

<Section title="無効">
  <div class="demo-row">
    <Button variant="primary" disabled>プライマリー</Button>
    <Button disabled>セカンダリー</Button>
  </div>
</Section>
