<script module lang="ts">
  /** the modifier that opens the search with K: ⌘ on Apple platforms, where Ctrl+K deletes to the end of a line */
  export const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
</script>

<script lang="ts">
  import type { Entry, TailwindListItem, TailwindSource } from '../types.js';
  import { formatHash, formatTailwindHash } from './hash.js';
  import { categoryTitles, type Messages } from './i18n.js';
  import { search, type SearchHit, type SearchItem, type SearchKind, type TailwindSearchItem } from './search.js';
  import { isColor } from './tailwind-filter.js';

  let {
    entries,
    tailwind,
    locale,
    go,
    t
  }: {
    entries: Entry[];
    /** the entries without an error */
    tailwind: TailwindListItem[];
    locale: 'en' | 'ja';
    go: (hash: string) => void;
    t: Messages;
  } = $props();

  let dialog: HTMLDialogElement;
  let input: HTMLInputElement;
  // the Tailwind CSS filter option; no group name can equal it
  const TAILWIND = Symbol('tailwind');
  let query = $state('');
  let group = $state<string | typeof TAILWIND | null>(null);
  let active = $state(0);
  const id = $props.id();

  type Meta = Pick<SearchItem, 'sections' | 'doc' | 'props'>;
  // loaded on the first open only, so the catalog page does not import every metadata module up front
  let metas = $state.raw<Map<string, Meta>>();
  let sources = $state.raw<TailwindSource[]>();
  let loading = false;

  // DOMParser documents are inert: no scripts run and no images load
  const text = (html: string | null | undefined) =>
    html ? (new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '') : '';

  function load() {
    if (loading) return;
    loading = true;
    Promise.all(
      entries.map(async (e): Promise<[string, Meta | null]> => {
        try {
          const { sections, doc, props } = (await e.meta()).default;
          const found = (props ?? []).map((p) => ({ name: p.name, description: text(p.description) }));
          return [e.path, { sections: sections.map((s) => s.title), doc: text(doc), props: found }];
        } catch {
          // a broken file shows its own error on its page; here it is found by its ID only
          return [e.path, null];
        }
      })
    ).then((pairs) => {
      metas = new Map(pairs.filter((p): p is [string, Meta] => p[1] !== null));
      active = 0;
    });
    // an entry that fails to load shows its error on its own page
    Promise.all(
      tailwind.map((s) =>
        s.load().then(
          ({ default: data }) => (data.error ? [] : [data]),
          () => []
        )
      )
    ).then((found) => {
      sources = found.flat();
      active = 0;
    });
  }

  const items = $derived(
    entries.map((e) => ({
      path: e.path,
      name: e.name,
      group: e.group,
      ...(metas?.get(e.path) ?? { sections: [], doc: '', props: [] })
    }))
  );
  const tailwindItems = $derived(
    (sources ?? []).flatMap((data): TailwindSearchItem[] => [
      ...data.categories.map((c) => ({
        source: data.id,
        category: c.id,
        title: categoryTitles[locale][c.id],
        tokens: c.tokens
      })),
      {
        source: data.id,
        category: 'full-config',
        title: categoryTitles[locale]['full-config'],
        tokens: Object.entries(data.variables).map(([name, value]) => ({ class: null, cssVariable: name, value }))
      }
    ])
  );
  // only several entries need telling apart, as the group and directory do for components
  const files = $derived(tailwind.length > 1 ? new Map(tailwind.map((s) => [s.id, s.file])) : null);
  const groups = $derived([
    null,
    ...new Set(entries.map((e) => e.group)),
    ...(tailwind.length ? ([TAILWIND] as const) : [])
  ]);
  const kinds = $derived<[SearchKind, string][]>([
    ['component', t.searchComponents],
    ['section', t.searchSections],
    ['prop', t.searchProps],
    ['description', t.searchDescriptions],
    ['tailwind', t.tailwind]
  ]);
  // already in the order of `kinds`, so ↑ and ↓ move down the list as shown
  // what the selected group searches, or a Tailwind CSS query would say No matches before its tokens are in
  const loaded = $derived(group === TAILWIND ? !!sources : typeof group === 'string' ? !!metas : !!(metas && sources));
  const hits = $derived(
    search(
      group === TAILWIND ? [] : items,
      query,
      typeof group === 'string' ? new Set([group]) : null,
      undefined,
      group === null || group === TAILWIND ? tailwindItems : []
    )
  );

  export function open() {
    if (!dialog.open) dialog.showModal();
    active = 0;
    input.focus();
    input.select();
    load();
  }

  function pick(hit: SearchHit) {
    dialog.close();
    const next =
      hit.kind === 'tailwind'
        ? formatTailwindHash(hit.item.source, hit.item.category, hit.label)
        : formatHash('detail', hit.item.path, hit.kind === 'section' ? hit.label : undefined);
    go(next);
  }

  function onkeydown(e: KeyboardEvent) {
    // Enter and the arrows also confirm and move through an IME's candidates
    if (e.isComposing) return;
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && hits.length) {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
      document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault();
      pick(hits[active]);
    }
  }
</script>

<!-- a click on the backdrop targets the dialog itself; its content sits in .body -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<dialog
  bind:this={dialog}
  class="search"
  aria-label={t.searchCatalog}
  onclick={(e) => e.target === dialog && dialog.close()}
>
  <div class="body">
    <input
      type="text"
      role="combobox"
      bind:this={input}
      bind:value={query}
      oninput={() => (active = 0)}
      {onkeydown}
      aria-label={t.searchCatalog}
      aria-expanded={hits.length > 0}
      aria-controls="{id}-results"
      aria-autocomplete="list"
      aria-activedescendant={hits.length ? `${id}-${active}` : undefined}
      placeholder={tailwind.length ? t.searchPlaceholderTailwind : t.searchPlaceholder}
      autocomplete="off"
      spellcheck="false"
    />
    {#if groups.length > 2}
      <div class="groups" role="group" aria-label={t.searchGroups}>
        {#each groups as g (g)}
          <button
            type="button"
            aria-pressed={group === g}
            onclick={() => {
              group = g;
              active = 0;
            }}>{g === null ? t.searchAllGroups : g === TAILWIND ? t.tailwind : g}</button
          >
        {/each}
      </div>
    {/if}
    <div class="results" role="listbox" id="{id}-results" aria-label={t.searchResults}>
      {#each kinds as [kind, label] (kind)}
        {#if hits.some((h) => h.kind === kind)}
          <div role="group" aria-labelledby="{id}-{kind}">
            <div class="kind" id="{id}-{kind}">{label}</div>
            {#each hits as hit, i (i)}
              {#if hit.kind === kind}
                <!-- the keyboard stays on the input, as the combobox pattern has it -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                  role="option"
                  id="{id}-{i}"
                  tabindex="-1"
                  aria-selected={i === active}
                  onmousedown={(e) => e.preventDefault()}
                  onmousemove={() => (active = i)}
                  onclick={() => pick(hit)}
                >
                  {#if hit.kind === 'tailwind'}
                    <span class="line">
                      {#if hit.label}
                        <!-- a plain colour, not the entry's CSS, so it can be drawn in the catalog document -->
                        {#if hit.value && isColor(hit.value)}
                          <span class="swatch" style:background-color={hit.value}></span>
                        {/if}
                        <span class="name code">{hit.label}</span>
                        <span class="group"
                          >{[hit.item.title, files?.get(hit.item.source)].filter(Boolean).join(' · ')}</span
                        >
                      {:else}
                        <span class="name">{hit.item.title}</span>
                        {#if files}<span class="group">{files.get(hit.item.source)}</span>{/if}
                      {/if}
                    </span>
                  {:else}
                    <span class="line">
                      <span class="name">{hit.item.name}</span>
                      {#if hit.label}<span class="label" class:code={hit.kind === 'prop'}>{hit.label}</span>{/if}
                      <!-- the group and the directory, so two components with one name tell apart -->
                      <span class="group">{hit.item.path.slice(0, hit.item.path.lastIndexOf('/'))}</span>
                    </span>
                    {#if hit.snippet}<span class="snippet">{hit.snippet}</span>{/if}
                  {/if}
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      {/each}
    </div>
    {#if query.trim() && !hits.length && loaded}
      <p class="empty">{t.noMatches}</p>
    {/if}
    <div class="sr-only" role="status">
      {#if query.trim() && loaded}
        {hits.length ? `${t.searchResults}: ${hits.length}` : t.noMatches}
      {/if}
    </div>
  </div>
</dialog>

<style>
  .search {
    box-sizing: border-box;
    width: min(560px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    margin: min(12vh, 96px) auto auto;
    padding: 0;
    border: 1px solid var(--_border);
    border-radius: 12px;
    background: var(--_bg);
    color: var(--_text);
    font-family: var(--_font);
    box-shadow: 0 24px 64px -12px rgb(0 0 0 / 0.45);
  }

  .search::backdrop {
    background: rgb(0 0 0 / 0.45);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
  }

  input {
    box-sizing: border-box;
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--_border);
    border-radius: 6px;
    background: var(--_bg);
    color: var(--_text);
    font: inherit;
    font-size: 16px;
  }

  input:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: -1px;
  }

  .groups {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .groups button {
    padding: 2px 10px;
    border: 1px solid var(--_border);
    border-radius: 999px;
    background: var(--_bg);
    color: var(--_muted);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .groups button[aria-pressed='true'] {
    border-color: var(--_accent);
    color: var(--_text);
    font-weight: 600;
  }

  .results {
    max-height: min(60vh, 440px);
    overflow-y: auto;
  }

  .results:empty {
    display: none;
  }

  .kind {
    padding: 8px 8px 4px;
    color: var(--_muted);
    font-size: 12px;
    font-weight: 600;
  }

  [role='option'] {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
  }

  [role='option'][aria-selected='true'] {
    background: var(--_code-bg);
    box-shadow: inset 2px 0 var(--_accent);
  }

  /* forced colors mode drops the background, shadow and border color that mark these, but keeps an outline */
  @media (forced-colors: active) {
    [role='option'][aria-selected='true'],
    .groups button[aria-pressed='true'] {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
  }

  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }

  .name {
    min-width: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .code {
    font-family: var(--_mono);
    font-size: 13px;
  }

  .swatch {
    /* a color sample: forced colors mode would replace it with the system's */
    forced-color-adjust: none;
    /* the base value, as in the light sample frame: a dark catalog would pick the dark side of `light-dark()` */
    color-scheme: light;
    flex: none;
    align-self: center;
    width: 14px;
    height: 14px;
    border-radius: 3px;
    /* white and black stay visible on either catalog theme */
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--_text) 25%, transparent);
  }

  .group {
    min-width: 0;
    margin-left: auto;
    color: var(--_muted);
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .snippet {
    overflow: hidden;
    color: var(--_muted);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    margin: 0 8px 4px;
    color: var(--_muted);
    font-size: 14px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
