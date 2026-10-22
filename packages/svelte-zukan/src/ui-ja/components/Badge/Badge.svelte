<script lang="ts">
  import Badge from '../../../lib/components/Badge/Badge.svelte';

  let {
    label
  }: {
    /** グループ名などの文字列 */
    label: string;
  } = $props();
</script>

<Badge {label} />
