<script lang="ts">
  let {
    label
  }: {
    /** the text, such as a group name */
    label: string;
  } = $props();
</script>

<span class="badge">{label}</span>

<style>
  .badge {
    display: inline-block;
    padding: 0 6px;
    border: 1px solid var(--_border);
    border-radius: 999px;
    background: var(--_code-bg);
    color: var(--_muted);
    font-family: var(--_font);
    font-size: 11px;
    line-height: 18px;
    white-space: nowrap;
  }
</style>
