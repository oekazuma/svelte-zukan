<script lang="ts">
  import { mount, unmount, type ComponentProps } from 'svelte';
  import type { Theme } from '../components/PreviewFrame/storage.js';
  import type { TailwindListItem, TailwindSource } from '../types.js';
  import { CATEGORIES } from '../vite/tailwind-tokens.js';
  import { formatTailwindHash } from './hash.js';
  import { categoryGroups, categoryTitles, type Messages } from './i18n.js';
  import { filterVariables } from './tailwind-filter.js';
  import TailwindTokens from './TailwindTokens.svelte';

  let {
    sources,
    source,
    category,
    theme,
    locale,
    t
  }: {
    /** not empty */
    sources: TailwindListItem[];
    source: string | null;
    category: string | null;
    theme: Theme;
    locale: 'en' | 'ja';
    t: Messages;
  } = $props();

  const FULL = 'full-config';
  // the samples are drawn in the light; a dark catalog would otherwise switch on `prefers-color-scheme: dark` in here
  const srcdoc = $derived(
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><style>` +
      ':root{color-scheme:light !important}html,body{margin:0 !important;padding:0 !important;background:transparent !important}' +
      '</style></head><body></body></html>'
  );

  const item = $derived(sources.find((s) => s.id === source) ?? sources[0]);

  let loaded = $state.raw<{ item: TailwindListItem; data?: TailwindSource; error?: string }>();
  $effect(() => {
    const current = item;
    if (current.error) return;
    // a load that finishes after another entry was selected must not replace that entry's
    let stale = false;
    current.load().then(
      ({ default: data }) => {
        if (!stale) loaded = { item: current, data };
      },
      (e) => {
        if (!stale) loaded = { item: current, error: e instanceof Error ? e.message : String(e) };
      }
    );
    return () => (stale = true);
  });
  const data = $derived(loaded?.item === item ? loaded.data : undefined);
  const error = $derived(item.error ?? (loaded?.item === item ? (loaded.error ?? loaded.data?.error) : undefined));

  const titles = $derived(categoryTitles[locale]);
  const categories = $derived(data?.categories ?? []);
  const groups = $derived(
    categoryGroups
      .map((g) => ({ title: t[g.title], categories: g.ids.flatMap((id) => categories.filter((c) => c.id === id)) }))
      .filter((g) => g.categories.length)
  );
  // the default is the first one in the list, which is not the first in CATEGORIES when some are missing
  const selected = $derived(
    category === FULL ? undefined : (categories.find((c) => c.id === category) ?? groups[0]?.categories[0])
  );
  const current = $derived(selected?.id ?? FULL);
  const id = $props.id();
  const kind = $derived(CATEGORIES.find((c) => c.id === selected?.id)?.kind ?? 'value');

  let query = $state('');
  // the dictionary never changes while the catalog runs
  // svelte-ignore state_referenced_locally
  let sampleText = $state(t.sampleTextValue);

  const variables = $derived(filterVariables(data?.variables ?? {}, query));

  // mounted once per frame, so a filter or a category change updates the samples in place
  const tokenProps = $state<Partial<ComponentProps<typeof TailwindTokens>>>({});
  $effect.pre(() => {
    // Full config keeps the last category until the frame goes away
    if (selected) tokenProps.category = selected;
    Object.assign(tokenProps, { kind, query, sampleText, theme, t });
  });

  function samples(css: string) {
    return (iframe: HTMLIFrameElement) => {
      let app: ReturnType<typeof mount> | undefined;
      let observer: ResizeObserver | undefined;
      const onload = () => {
        const doc = iframe.contentDocument!;
        const style = doc.createElement('style');
        style.textContent = css;
        doc.head.append(style);
        app = mount(TailwindTokens, { target: doc.body, props: tokenProps as ComponentProps<typeof TailwindTokens> });
        const root = doc.body.querySelector('.zukan-tokens')!;
        // the root, not the body: the entry's CSS may give the body a min-height of the frame
        observer = new ResizeObserver(
          () => (iframe.style.height = `${Math.ceil(root.getBoundingClientRect().height)}px`)
        );
        observer.observe(root);
      };
      iframe.addEventListener('load', onload, { once: true });
      return () => {
        iframe.removeEventListener('load', onload);
        observer?.disconnect();
        if (app) unmount(app);
      };
    };
  }
</script>

<h1>{t.tailwind}</h1>
<p class="file">
  <code>{item.file}</code>{#if data?.version}{` · v${data.version}`}{/if}
</p>

{#if error}
  <p class="error">{t.tailwindError} {error}</p>
{:else if data}
  <div class="layout">
    <div class="columns">
      {#snippet link(category: keyof typeof titles, count: number)}
        <!-- the catalog is a hash-routed SPA outside SvelteKit, so resolve() does not apply -->
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a href={formatTailwindHash(item.id, category)} aria-current={category === current ? 'page' : undefined}>
          <span>{titles[category]}</span>
          <!-- the link is named by its category alone -->
          <span class="count" aria-hidden="true">{count}</span>
        </a>
      {/snippet}
      <nav aria-label={t.tailwindCategories}>
        {#each groups as group, i (group.title)}
          <h2 id="{id}-{i}">{group.title}</h2>
          <ul aria-labelledby="{id}-{i}">
            {#each group.categories as c (c.id)}
              <li>{@render link(c.id, c.tokens.length)}</li>
            {/each}
          </ul>
        {/each}
        <ul class="full">
          <li>{@render link(FULL, Object.keys(data.variables).length)}</li>
        </ul>
      </nav>

      <div class="content">
        <!-- replaces the list where it would squeeze the tokens -->
        <select
          aria-label={t.tailwindCategories}
          value={current}
          onchange={(e) => (location.hash = formatTailwindHash(item.id, e.currentTarget.value))}
        >
          {#each groups as group (group.title)}
            <optgroup label={group.title}>
              {#each group.categories as c (c.id)}
                <option value={c.id}>{titles[c.id]}</option>
              {/each}
            </optgroup>
          {/each}
          <option value={FULL}>{titles[FULL]}</option>
        </select>

        <div class="controls">
          <input
            type="search"
            bind:value={query}
            placeholder={t.filterTokens}
            aria-label={t.filterTokens}
            autocomplete="off"
          />
          {#if kind === 'text' || kind === 'text-color'}
            <input type="text" bind:value={sampleText} aria-label={t.sampleText} title={t.sampleText} />
          {/if}
        </div>

        {#if selected}
          {#key data}
            <iframe title={titles[selected.id]} {srcdoc} style="color-scheme: light" {@attach samples(data.css)}
            ></iframe>
          {/key}
        {:else}
          <table>
            <thead>
              <tr><th scope="col">{t.tokenVariable}</th><th scope="col">{t.tokenValue}</th></tr>
            </thead>
            <tbody>
              {#each variables as [name, value] (name)}
                <tr><td><code>{name}</code></td><td><code>{value}</code></td></tr>
              {:else}
                <tr><td colspan="2">{t.noTokens}</td></tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  h1 {
    margin: 0 0 4px;
    font-size: 24px;
  }

  .file {
    margin: 0 0 16px;
    color: var(--_muted);
    font-size: 13px;
  }

  code {
    font-family: var(--_mono);
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .error {
    padding: 12px 16px;
    border: 1px solid var(--_danger);
    border-radius: 6px;
    background: var(--_danger-bg);
    color: var(--_text);
  }

  .layout {
    container-type: inline-size;
  }

  .columns > * {
    min-width: 0;
  }

  nav {
    display: none;
  }

  h2 {
    margin: 16px 10px 4px;
    color: var(--_muted);
    font-size: 12px;
    font-weight: 600;
  }

  h2:first-child {
    margin-top: 0;
  }

  nav ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .full {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--_border);
  }

  /* drawn like the sidebar's links */
  nav a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 10px;
    border-radius: 6px;
    color: var(--_text);
    font-size: 14px;
    text-decoration: none;
  }

  nav a:hover {
    background: var(--_code-bg);
  }

  nav a[aria-current='page'] {
    background: var(--_code-bg);
    color: var(--_accent);
    font-weight: 600;
  }

  .count {
    padding: 0 6px;
    border-radius: 999px;
    background: var(--_code-bg);
    color: var(--_muted);
    font-size: 11px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  nav a:hover .count,
  nav a[aria-current='page'] .count {
    background: var(--_bg);
  }

  select {
    display: block;
    width: 100%;
    margin-bottom: 12px;
  }

  /* the list takes a column only where the tokens keep room for two cards */
  @container (min-width: 640px) {
    .columns {
      display: grid;
      grid-template-columns: 200px minmax(0, 1fr);
      gap: 24px;
      align-items: start;
    }

    nav {
      display: block;
      position: sticky;
      top: 24px;
      max-height: calc(100vh - 48px);
      overflow-y: auto;
    }

    select {
      display: none;
    }
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  input,
  select {
    box-sizing: border-box;
    min-width: 0;
    flex: 1 1 240px;
    max-width: 400px;
    padding: 4px 8px;
    border: 1px solid var(--_border);
    border-radius: 6px;
    background: var(--_bg);
    color: var(--_text);
    font: inherit;
    font-size: 14px;
  }

  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--_accent);
    outline-offset: -1px;
  }

  iframe {
    display: block;
    width: 100%;
    height: 0;
    border: 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  th,
  td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--_border);
    text-align: left;
    vertical-align: top;
  }

  th {
    color: var(--_muted);
    font-weight: 600;
  }
</style>
