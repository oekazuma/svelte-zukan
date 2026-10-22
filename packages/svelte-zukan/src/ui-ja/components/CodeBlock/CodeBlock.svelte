<script lang="ts">
  import { messages, type Messages } from '../../../lib/app/i18n.js';
  import CodeBlock from '../../../lib/components/CodeBlock/CodeBlock.svelte';

  let {
    code,
    labels = messages.ja
  }: {
    /** 表示し、コピーするソース */
    code: string;
    /** UI の文言。カタログは自身の `locale` の文言を渡す */
    labels?: Pick<Messages, 'code' | 'copy' | 'copied' | 'copyFailed'>;
  } = $props();
</script>

<CodeBlock {code} {labels} />
