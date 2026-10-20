<script lang="ts">
  import type { Entry } from '../types.js';
  import { formatHash } from './hash.js';
  import type { Messages } from './i18n.js';

  let { entries, searched, t }: { entries: Entry[]; searched: { group: string; dirs: string[] }[]; t: Messages } =
    $props();

  // the catalog is already in group order; a Map keeps it
  const groups = $derived(
    entries.reduce(
      (map, entry) => map.set(entry.group, [...(map.get(entry.group) ?? []), entry]),
      new Map<string, Entry[]>()
    )
  );

  const hue = (name: string) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 11);
  const id = $props.id();
</script>

<h1>{t.listHeading}</h1>
{#if entries.length}
  {#each groups as [group, items], i (group)}
    <section aria-labelledby="{id}-{i}">
      <h2 id="{id}-{i}">{group} <span class="count">{items.length}</span></h2>
      <ul>
        {#each items as entry (entry.path)}
          <li>
            <!-- the catalog is a hash-routed SPA outside SvelteKit, so resolve() does not apply -->
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
            <a href={formatHash('detail', entry.path)}>
              <span class="mark" style:--hue={hue(entry.name)} aria-hidden="true">{entry.name[0]}</span>
              <span class="text">
                <span class="name">{entry.name}</span>
                {#if entry.dir}<span class="dir">{entry.dir}</span>{/if}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
{:else}
  <p>{t.empty}</p>
  <ul class="searched">
    <!-- group names are not guaranteed unique, so key by index -->
    {#each searched as { group, dirs }, i (i)}
      <li>{group}: {dirs.join(', ')}</li>
    {/each}
  </ul>
{/if}

<style>
  h1 {
    margin: 0 0 16px;
    font-size: 24px;
  }

  section + section {
    margin-top: 28px;
  }

  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px;
    color: var(--_muted);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
    overflow-wrap: anywhere;
  }

  .count {
    padding: 0 7px;
    border-radius: 999px;
    background: var(--_code-bg);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  a {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 100%;
    box-sizing: border-box;
    padding: 12px 14px;
    border: 1px solid var(--_border);
    border-radius: 10px;
    background: var(--_bg);
    color: var(--_text);
    text-decoration: none;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }

  a:hover {
    border-color: var(--_accent);
    box-shadow: 0 2px 10px -4px color-mix(in srgb, var(--_accent) 40%, transparent);
  }

  a:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: 2px;
  }

  .mark {
    display: grid;
    place-items: center;
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    /* dark enough for white text at every hue */
    background: hsl(var(--hue) 60% 42%);
    color: #fff;
    font-weight: 700;
  }

  .text {
    display: grid;
    min-width: 0;
  }

  .name {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .dir {
    color: var(--_muted);
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .searched {
    display: block;
    padding-left: 20px;
    list-style: disc;
  }
</style>
