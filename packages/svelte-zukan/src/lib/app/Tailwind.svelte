<script lang="ts">
  import { mount, unmount, type ComponentProps } from 'svelte';
  import type { Theme } from '../components/PreviewFrame/storage.js';
  import type { TailwindListItem, TailwindSource } from '../types.js';
  import { CATEGORIES } from '../vite/tailwind-tokens.js';
  import { formatTailwindHash } from './hash.js';
  import { categoryTitles, type Messages } from './i18n.js';
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
  const selected = $derived(
    category === FULL ? undefined : (categories.find((c) => c.id === category) ?? categories[0])
  );
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
  <ul class="categories">
    {#each [...categories.map((c) => c.id), FULL] as id (id)}
      {@const active = id === (selected?.id ?? FULL)}
      <li>
        <!-- the catalog is a hash-routed SPA outside SvelteKit, so resolve() does not apply -->
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a href={formatTailwindHash(item.id, id)} aria-current={active ? 'page' : undefined}>
          {titles[id as keyof typeof titles] ?? id}
        </a>
      </li>
    {/each}
  </ul>

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
      <iframe title={titles[selected.id]} {srcdoc} style="color-scheme: light" {@attach samples(data.css)}></iframe>
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

  .categories {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 0 0 16px;
    padding: 0;
    list-style: none;
  }

  .categories a {
    display: block;
    padding: 4px 10px;
    border: 1px solid var(--_border);
    border-radius: 999px;
    color: var(--_text);
    font-size: 13px;
    text-decoration: none;
  }

  .categories a:hover {
    background: var(--_code-bg);
  }

  .categories a[aria-current='page'] {
    border-color: var(--_accent);
    background: var(--_code-bg);
    color: var(--_accent);
    font-weight: 600;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  input {
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

  input:focus-visible {
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
