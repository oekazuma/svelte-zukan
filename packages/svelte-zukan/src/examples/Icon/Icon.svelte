<script lang="ts" module>
  /** 24×24 stroke paths */
  export const ICONS = {
    check: ['M5 12.5l4.5 4.5L19 7'],
    x: ['M6 6l12 12', 'M18 6L6 18'],
    plus: ['M12 5v14', 'M5 12h14'],
    'arrow-left': ['M19 12H5', 'M11 6l-6 6 6 6'],
    'arrow-right': ['M5 12h14', 'M13 6l6 6-6 6'],
    info: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 11v6', 'M12 7.5v.01'],
    warning: ['M12 3.5L2.5 20h19L12 3.5z', 'M12 10v4.5', 'M12 17.5v.01'],
    success: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M8 12.5l2.7 2.7L16 9.8'],
    error: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M9 9l6 6', 'M15 9l-6 6'],
    upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3'],
    mail: ['M3.5 6h17v12h-17z', 'M3.5 7l8.5 6 8.5-6'],
    search: ['M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z', 'M15.5 15.5L20 20'],
    heart: ['M12 20s-7-4.4-9-9a4.5 4.5 0 0 1 9-2.5A4.5 4.5 0 0 1 21 11c-2 4.6-9 9-9 9z'],
    star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z']
  } satisfies Record<string, string[]>;

  export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
  let {
    name,
    size = 18,
    label
  }: {
    /** one of the names in the "All icons" section */
    name: IconName;
    /** width and height in pixels */
    size?: number;
    /** give one when the icon stands alone; without it the icon is hidden from screen readers */
    label?: string;
  } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  {#each ICONS[name] as d (d)}
    <path {d} />
  {/each}
</svg>

<style>
  svg {
    flex: none;
    vertical-align: middle;
  }
</style>
