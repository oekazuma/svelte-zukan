<script lang="ts">
  import Badge from '../components/Badge/Badge.svelte';
  import CodeBlock from '../components/CodeBlock/CodeBlock.svelte';
  import PreviewFrame from '../components/PreviewFrame/PreviewFrame.svelte';
  import type { Theme } from '../components/PreviewFrame/storage.js';
  import type { Entry } from '../types.js';
  import { formatHash } from './hash.js';
  import type { Messages } from './i18n.js';

  let {
    entry,
    section = null,
    previous,
    next,
    theme,
    t
  }: {
    entry: Entry;
    section?: string | null;
    previous?: Entry;
    next?: Entry;
    theme: Theme;
    t: Messages;
  } = $props();

  // the section whose heading was last scrolled past the top third of the window
  let active = $state<string | null>(null);
  function track(node: HTMLElement, title: string) {
    const observer = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) active = title;
      },
      { rootMargin: '0px 0px -66% 0px' }
    );
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }

  // the detail page is not remounted when only the section changes, so the action also runs on update
  function reveal(node: HTMLElement, active: boolean) {
    if (active) node.scrollIntoView();
    return { update: (next: boolean) => next && node.scrollIntoView() };
  }
</script>

{#snippet pagerLink(to: Entry, rel: 'prev' | 'next')}
  <!-- a hash route of this catalog, not a SvelteKit route -->
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
  <a class={rel} href={formatHash('detail', to.path)} {rel}>
    <span class="hint">{rel === 'prev' ? `← ${t.previous}` : `${t.next} →`}</span>
    <span class="target"
      >{to.name}{#if to.dir}<span class="dir">{to.dir}</span>{/if}</span
    >
  </a>
{/snippet}

<h1>
  {entry.name}
  {#if entry.dir}<span class="dir">{entry.dir}</span>{/if}
  <Badge label={entry.group} />
</h1>

<!-- recreate everything on navigation so no PreviewFrame keeps the previous entry's width or height -->
{#key entry.path}
  {#await entry.meta() then { default: meta }}
    <div class="page">
      <div class={['layout', { toc: meta.sections.length > 1 }]}>
        <div class="content">
          {#if meta.doc}
            <!-- the HTML comes from the user's own .md file, rendered by the plugin -->
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            <div class="doc">{@html meta.doc}</div>
          {/if}
          {#if !meta.sections.length}
            <p class="empty">{t.noSections}</p>
          {/if}
          {#each meta.sections as s (s.title)}
            <h2 use:reveal={section === s.title} use:track={s.title}>
              <!-- a hash route of this catalog, not a SvelteKit route -->
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
              <a href={formatHash('detail', entry.path, s.title)}>{s.title}</a>
            </h2>
            <div class="example">
              <!-- the page's own path: "./" drops index.html, and the query is not part of the catalog -->
              <PreviewFrame
                src={location.pathname + formatHash('preview', entry.path, s.title)}
                title={s.title}
                {theme}
                labels={t}
              />
              <CodeBlock code={s.code} labels={t} />
            </div>
          {/each}
          {#if meta.props?.length || meta.propsType}
            <h2>{t.props}</h2>
            {#if meta.propsType}
              <p class="props-type">{t.propsType} <code>{meta.propsType}</code></p>
            {/if}
            {#if meta.props?.length}
              <div class="props">
                <table>
                  <thead>
                    <tr>
                      <th>{t.propName}</th>
                      <th>{t.propType}</th>
                      <th>{t.propDefault}</th>
                      <th>{t.propDescription}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each meta.props as p (p.name)}
                      <tr>
                        <td>
                          <code class="name">{p.name}</code>
                          {#if p.required}<span class="flag">{t.required}</span>{/if}
                          {#if p.bindable}<span class="flag">{t.bindable}</span>{/if}
                        </td>
                        <td
                          >{#if p.type}<code>{p.type}</code>{/if}</td
                        >
                        <td
                          >{#if p.default}<code>{p.default}</code>{/if}</td
                        >
                        <!-- rendered by the plugin from the component's own JSDoc -->
                        <!-- eslint-disable svelte/no-at-html-tags -->
                        <td
                          >{#if p.description}{@html p.description}{/if}</td
                        >
                        <!-- eslint-enable svelte/no-at-html-tags -->
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          {/if}
          {#if previous || next}
            <nav class="pager" aria-label="{t.previous} / {t.next}">
              {#if previous}{@render pagerLink(previous, 'prev')}{/if}
              {#if next}{@render pagerLink(next, 'next')}{/if}
            </nav>
          {/if}
        </div>
        {#if meta.sections.length > 1}
          <nav class="contents" aria-label={t.onThisPage}>
            <p>{t.onThisPage}</p>
            <ul>
              {#each meta.sections as s (s.title)}
                <li>
                  <!-- a hash route of this catalog, not a SvelteKit route -->
                  <!-- eslint-disable svelte/no-navigation-without-resolve -->
                  <a
                    href={formatHash('detail', entry.path, s.title)}
                    aria-current={active === s.title ? 'location' : undefined}>{s.title}</a
                  >
                  <!-- eslint-enable svelte/no-navigation-without-resolve -->
                </li>
              {/each}
            </ul>
          </nav>
        {/if}
      </div>
    </div>
  {:catch error}
    <p>{t.loadFailed} {error instanceof Error ? error.message : String(error)}</p>
  {/await}
{/key}

<style>
  h1 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px;
    font-size: 24px;
  }

  .dir {
    color: var(--_muted);
    font-size: 14px;
    font-weight: normal;
  }

  h2 {
    margin: 32px 0 10px;
    font-size: 18px;
  }

  .example {
    overflow: hidden;
    border: 1px solid var(--_border);
    border-radius: 10px;
  }

  /* class selectors, so these win over the components' own borders whatever the CSS order */
  .example > :global(:is(.preview, .code-block)) {
    border: 0;
    border-radius: 0;
  }

  .example > :global(.code-block) {
    border-top: 1px solid var(--_border);
  }

  h2 a {
    color: inherit;
    text-decoration: none;
  }

  h2 a:hover,
  h2 a:focus-visible {
    text-decoration: underline;
  }

  /* the rendered .md: plain HTML, so its elements are styled from here */
  .doc {
    max-width: 72ch;
    line-height: 1.7;
  }

  .doc :global(:is(p, ul, ol, pre, table, blockquote)) {
    margin: 0 0 12px;
  }

  .doc :global(:is(ul, ol)) {
    padding-left: 1.4em;
  }

  .doc :global(li + li) {
    margin-top: 4px;
  }

  .doc :global(:is(h1, h2, h3, h4)) {
    margin: 24px 0 8px;
    font-size: 16px;
  }

  .doc :global(a) {
    color: var(--_accent);
  }

  .doc :global(code) {
    padding: 0.1em 0.3em;
    border-radius: 4px;
    background: var(--_code-bg);
    font-family: var(--_mono);
    font-size: 0.875em;
  }

  .doc :global(pre) {
    padding: 12px 14px;
    overflow-x: auto;
    border-radius: 8px;
    background: var(--_code-bg);
  }

  .doc :global(pre code) {
    padding: 0;
    background: none;
  }

  .doc :global(blockquote) {
    padding-left: 12px;
    border-left: 3px solid var(--_border);
    color: var(--_muted);
  }

  .doc :global(table) {
    border-collapse: collapse;
  }

  .doc :global(:is(th, td)) {
    padding: 6px 10px;
    border: 1px solid var(--_border);
    text-align: left;
  }

  .empty {
    color: var(--_muted);
  }

  .props {
    overflow-x: auto;
  }

  .props table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .props :is(th, td) {
    padding: 8px 12px;
    border-bottom: 1px solid var(--_border);
    text-align: left;
    vertical-align: top;
  }

  .props th {
    color: var(--_muted);
    font-weight: 600;
    white-space: nowrap;
  }

  .props td:first-child {
    white-space: nowrap;
  }

  .props :global(code),
  .props-type code {
    padding: 0.1em 0.3em;
    border-radius: 4px;
    background: var(--_code-bg);
    font-family: var(--_mono);
    font-size: 0.9em;
  }

  .props .name {
    font-weight: 600;
  }

  .flag {
    margin-left: 6px;
    color: var(--_muted);
    font-size: 12px;
  }

  .props-type {
    margin: 0 0 8px;
    color: var(--_muted);
    font-size: 14px;
  }

  .page {
    container-type: inline-size;
  }

  .layout.toc {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 200px;
    gap: 40px;
  }

  .contents {
    position: sticky;
    top: 24px;
    align-self: start;
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    font-size: 13px;
  }

  .contents p {
    margin: 0 0 8px;
    color: var(--_muted);
    font-weight: 600;
  }

  .contents ul {
    margin: 0;
    padding: 0;
    border-left: 1px solid var(--_border);
    list-style: none;
  }

  .contents a {
    display: block;
    margin-left: -1px;
    padding: 4px 12px;
    border-left: 2px solid transparent;
    color: var(--_muted);
    text-decoration: none;
  }

  .contents a:hover {
    color: var(--_text);
  }

  .contents a[aria-current='location'] {
    border-left-color: var(--_accent);
    color: var(--_accent);
    font-weight: 600;
  }

  @container (max-width: 900px) {
    .layout.toc {
      display: block;
    }

    .contents {
      display: none;
    }
  }

  .pager {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 40px;
  }

  .pager a {
    display: grid;
    gap: 2px;
    padding: 12px 16px;
    border: 1px solid var(--_border);
    border-radius: 10px;
    color: var(--_text);
    text-decoration: none;
  }

  .pager a:hover {
    border-color: var(--_accent);
  }

  .pager .next {
    grid-column: 2;
    text-align: right;
  }

  .hint {
    color: var(--_muted);
    font-size: 12px;
  }

  .target {
    font-weight: 600;
  }

  .target .dir {
    margin-left: 6px;
    font-size: 12px;
  }
</style>
