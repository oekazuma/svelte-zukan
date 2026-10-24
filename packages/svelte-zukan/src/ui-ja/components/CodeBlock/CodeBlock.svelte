<script lang="ts">
  import { messages, type Messages } from '../../../lib/app/i18n.js';
  import CodeBlock from '../../../lib/components/CodeBlock/CodeBlock.svelte';

  let {
    code,
    labels = messages.ja,
    open = $bindable(false)
  }: {
    /** 表示し、コピーするソース */
    code: string;
    /** UI の文言。カタログは自身の `locale` の文言を渡す */
    labels?: Pick<Messages, 'code' | 'copy' | 'copied' | 'copyFailed'>;
    /** コードを開いて表示しているか。最初は閉じている */
    open?: boolean;
  } = $props();
</script>

<CodeBlock {code} {labels} bind:open />
