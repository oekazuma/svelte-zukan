<script module lang="ts">
  import type { Entry } from '../types.js';

  // Back renders the page at once, before the browser restores its position, and a promise renders `then` only later,
  // on a page cut to one screen. A `zukan:reload` reloads the whole page, which empties this
  const loaded = new WeakMap<Entry['meta'], Awaited<ReturnType<Entry['meta']>>>();
  function loadMeta(entry: Entry) {
    return loaded.get(entry.meta) ?? entry.meta().then((m) => (loaded.set(entry.meta, m), m));
  }
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import Badge from '../components/Badge/Badge.svelte';
  import CodeBlock from '../components/CodeBlock/CodeBlock.svelte';
  import PreviewFrame from '../components/PreviewFrame/PreviewFrame.svelte';
  import type { Theme } from '../components/PreviewFrame/storage.js';
  import { followsHere, formatHash, parseHash } from './hash.js';
  import type { Messages } from './i18n.js';
  import { unionMembers } from './union.js';

  let {
    entry,
    section = null,
    width,
    restored = false,
    previous,
    next,
    theme,
    axe,
    t
  }: {
    entry: Entry;
    section?: string | null;
    width?: number | null;
    /** the route came from Back or Forward, whose scroll position the browser restores */
    restored?: boolean;
    previous?: Entry;
    next?: Entry;
    theme: Theme;
    axe?: () => Promise<string>;
    t: Messages;
  } = $props();

  // the section whose heading was last scrolled past the top third of the window
  let active = $state<string | null>(null);
  /**
   * The props heading in `active` and in the URL's `section`; section titles are never empty, so it can not clash
   * with one
   */
  const PROPS = '';
  /** the headings by title, the props' included, in page order: they mount in order */
  // only read by the handlers, never by the markup, so it needs no reactivity
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const headings = new Map<string, HTMLElement>();
  /**
   * Set when the URL brings a heading into view: the heading stays marked until the reader scrolls, as one near the
   * end of the page can not reach the top third, where the observer would mark the one above it
   */
  let pinned = false;
  /** the reader ended a pin: their scroll marks the heading in the top third, which the observer may never report */
  let released = false;
  function track(node: HTMLElement, title: string) {
    headings.set(title, node);
    const observer = new IntersectionObserver(
      // the last entry: one call can carry the heading leaving and entering again
      (entries) => {
        if (entries.at(-1)!.isIntersecting && !pinned) active = title;
      },
      { rootMargin: '0px 0px -66% 0px' }
    );
    observer.observe(node);
    return {
      destroy: () => {
        observer.disconnect();
        headings.delete(title);
      }
    };
  }
  /**
   * The content's height when the pinned heading was last scrolled to, rather than at the observer's first report,
   * which comes a frame later and may already include the growth
   */
  let contentHeight = 0;
  // the previews above a pinned heading grow as they load and push it down, and the page may only now be tall enough
  // to bring it to the top
  const follow = new ResizeObserver(([entry]) => {
    if (pinned && active !== null && entry.borderBoxSize[0].blockSize !== contentHeight) show(active);
  });
  $effect(() => () => follow.disconnect());
  // marked on the scroll rather than here: a key or a click that does not scroll must not move the mark off the pin
  function unpin() {
    if (pinned) released = true;
    pinned = false;
    follow.disconnect();
  }
  // a route with no section names no heading to keep in view; the headings' actions see only their own title
  $effect(() => {
    if (section === null) {
      unpin();
      expandedTitle = null;
    }
  });
  function onscroll() {
    if (!released || pinned) return;
    released = false;
    const last = [...headings].findLast(([, h]) => h.getBoundingClientRect().top <= innerHeight * 0.34);
    if (last) active = last[0];
  }

  let expandedTitle = $state<string | null>(null);

  /** the section in view, or the first one, fills the page; again, it goes back */
  export function toggleExpanded() {
    const titles = [...headings.keys()].filter((t) => t !== PROPS);
    // the props come before the first section
    if (expandedTitle !== null) expandedTitle = null;
    else expandedTitle = (active === PROPS ? null : active) ?? titles[0] ?? null;
  }

  /** scrolls to a heading and marks it; the props heading takes the focus, so the keyboard goes on from it */
  function show(title: string, heading = headings.get(title)) {
    if (!heading) return;
    heading.scrollIntoView();
    active = title;
    pinned = true;
    // the headings are children of the content
    const content = heading.parentElement!;
    contentHeight = content.getBoundingClientRect().height;
    follow.observe(content);
    if (title === PROPS) heading.focus({ preventScroll: true });
  }

  /**
   * `show` for a route: an expanded preview of another section would cover the one the route names. The page is
   * still inert until the preview has left, so the props heading could not take the focus before then
   */
  function showRoute(title: string, heading?: HTMLElement) {
    if (expandedTitle === null || expandedTitle === title) return show(title, heading);
    expandedTitle = null;
    tick().then(() => show(title));
  }

  /**
   * Brings the section into view when `hash` goes to the one shown. The route does not change then, so `reveal` does
   * not run: the URL is that route already (no hashchange), or an anchor in the doc left it behind
   */
  export function revealRoute(hash: string) {
    const to = parseHash(hash);
    if (to.view !== 'detail' || to.path !== entry.path || to.section !== section) return;
    // the unchanged hash fires no hashchange, whose handler scrolls a page without a section to the top
    if (section === null) {
      expandedTitle = null;
      scrollTo(0, 0);
    } else showRoute(section);
  }

  function onclick(e: MouseEvent) {
    const link = e.target instanceof Element ? e.target.closest('a') : null;
    if (link && followsHere(e, link)) revealRoute(link.hash);
  }

  /** Vite's own endpoint, the one its error overlay uses; it is under the app's `base` like the catalog */
  function openInEditor(file: string) {
    fetch(`${location.pathname.replace(/__zukan\/.*$/, '')}__open-in-editor?file=${encodeURIComponent(file)}`);
  }

  // the detail page is not remounted when only the section changes, so the action also runs on update. Back and
  // Forward only mark the heading: the browser restores the position the reader left
  function reveal(node: HTMLElement, title: string | null) {
    const apply = (next: string | null) => {
      if (next === null) return;
      if (!restored) return showRoute(next, node);
      // a pin left by the previous route would bring its heading back as the previews grow
      unpin();
      if (expandedTitle !== next) expandedTitle = null;
      active = next;
    };
    apply(title);
    return { update: apply };
  }

  /**
   * A section that names no heading (renamed since the link was made) opens the page at the top, as one without a
   * section does; the hashchange handler leaves a page with a section to `reveal`, which then never runs
   */
  function top(_: HTMLElement, unmatched: string | null) {
    const apply = (next: string | null) => {
      if (next === null) return;
      unpin();
      if (!restored) scrollTo(0, 0);
    };
    apply(unmatched);
    return { update: apply };
  }

  /**
   * A table wider than the page scrolls in a box of its own, as the props do. A wrapper rather than `display: block`
   * on the table, which drops its table semantics in some screen readers. The `{#key}` around it gives each new HTML a
   * new element, so this runs for it and `{@html}` never has to remove nodes moved here
   */
  function scrollTables(node: HTMLElement) {
    for (const table of node.querySelectorAll('table')) {
      const box = document.createElement('div');
      box.className = 'table';
      table.before(box);
      box.append(table);
      // focusable, so a keyboard can scroll the box: arrow keys scroll the focused element's scroll container
      table.tabIndex = 0;
    }
  }
</script>

<!-- what the reader does to scroll, in a preview too, which forwards these to its iframe; a scroll event alone would
  also come from `show` -->
<svelte:window {onclick} {onscroll} onwheel={unpin} ontouchmove={unpin} onkeydown={unpin} onpointerdown={unpin} />

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

{#if entry.edit}
  <div class="edit" role="group" aria-labelledby="zukan-edit">
    <span id="zukan-edit">{t.openInEditor}</span>
    {#each [entry.edit.file, entry.edit.component] as file (file)}
      {#if file}
        <button type="button" onclick={() => openInEditor(file)}>{file.slice(file.lastIndexOf('/') + 1)}</button>
      {/if}
    {/each}
  </div>
{/if}

{#await loadMeta(entry) then { default: meta }}
  {@const hasProps = !!(meta.props?.length || meta.propsType)}
  {@const toc = meta.sections.length + (hasProps ? 1 : 0) > 1}
  <div
    class="page"
    use:top={section === null || (section === PROPS && hasProps) || meta.sections.some((s) => s.title === section)
      ? null
      : section}
  >
    <div class={['layout', { toc }]}>
      <div class="content">
        {#if meta.doc}
          {#key meta.doc}
            <!-- the HTML comes from the user's own .md file, rendered by the plugin -->
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            <div class="doc" use:scrollTables>{@html meta.doc}</div>
          {/key}
        {/if}
        {#if hasProps}
          <h2 id="zukan-props" tabindex="-1" use:track={PROPS} use:reveal={section === PROPS ? PROPS : null}>
            {t.props}
          </h2>
          {#if meta.propsType}
            <p class="props-type">{t.propsType} <code>{meta.propsType}</code></p>
          {/if}
          {#if meta.props?.length}
            <!-- focusable, so a keyboard can scroll the table when it is wider than the page -->
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <div class="props" role="region" aria-label={t.props} tabindex="0">
              <!-- the roles keep it a table for screen readers when a narrow layout changes its display -->
              <!-- svelte-ignore a11y_no_redundant_roles -->
              <table role="table">
                <!-- svelte-ignore a11y_no_redundant_roles -->
                <thead role="rowgroup">
                  <!-- svelte-ignore a11y_no_redundant_roles -->
                  <tr role="row">
                    <th role="columnheader">{t.propName}</th>
                    <th role="columnheader">{t.propType}</th>
                    <th role="columnheader">{t.propDefault}</th>
                    <th role="columnheader">{t.propDescription}</th>
                  </tr>
                </thead>
                <!-- svelte-ignore a11y_no_redundant_roles -->
                <tbody role="rowgroup">
                  {#each meta.props as p, i (i)}
                    <!-- svelte-ignore a11y_no_redundant_roles -->
                    <tr role="row">
                      <td role="cell">
                        <code class="name">{p.name}</code>
                        {#if p.required}<span class="flag required">{t.required}</span>{/if}
                        {#if p.bindable}<span class="flag bindable">{t.bindable}</span>{/if}
                      </td>
                      <!-- a union wraps between its members, never inside one such as `() => void` -->
                      <!-- the separator is a mustache because Svelte trims the spaces of plain text at the edges of a block, and those spaces are where the union wraps -->
                      <!-- eslint-disable svelte/no-useless-mustaches -->
                      <td role="cell" data-label={t.propType}
                        >{#if p.type}<code
                            >{#each unionMembers(p.type) as part, i (i)}{#if i}{' | '}{/if}<span class="type-part"
                                >{part}</span
                              >{/each}</code
                          >{/if}</td
                      >
                      <!-- eslint-enable svelte/no-useless-mustaches -->
                      <td role="cell" data-label={t.propDefault}
                        >{#if p.default}<code>{p.default}</code>{/if}</td
                      >
                      <!-- rendered by the plugin from the component's own JSDoc -->
                      <!-- eslint-disable svelte/no-at-html-tags -->
                      <td role="cell"
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
        {#if meta.error}
          <p class="empty">{t.loadFailed} {meta.error}</p>
        {:else if !meta.sections.length}
          <p class="empty">{t.noSections}</p>
        {/if}
        {#each meta.sections as s (s.title)}
          <h2 use:track={s.title} use:reveal={section === s.title ? s.title : null}>
            <!-- a hash route of this catalog, not a SvelteKit route -->
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
            <a href={formatHash('detail', entry.path, s.title)}>{s.title}</a>
          </h2>
          <div class="example">
            <!-- the page's own path: "./" drops index.html, and the query is not part of the catalog -->
            <PreviewFrame
              src={location.pathname + formatHash('preview', entry.path, s.title)}
              tabHref={location.pathname + formatHash('preview', entry.path, s.title, { theme })}
              shareUrl={(w) =>
                location.href.split('#')[0] + formatHash('detail', entry.path, s.title, { width: w, theme })}
              requestedWidth={section === s.title ? width : undefined}
              bind:expanded={() => expandedTitle === s.title, (v) => (expandedTitle = v ? s.title : null)}
              title={s.title}
              {axe}
              {theme}
              labels={t}
            />
            <CodeBlock code={s.code} labels={t} />
          </div>
        {/each}
        {#if previous || next}
          <nav class="pager" aria-label="{t.previous} / {t.next}">
            {#if previous}{@render pagerLink(previous, 'prev')}{/if}
            {#if next}{@render pagerLink(next, 'next')}{/if}
          </nav>
        {/if}
      </div>
      {#if toc}
        <nav class="contents" aria-label={t.onThisPage}>
          <p>{t.onThisPage}</p>
          <ul>
            {#if hasProps}
              <li>
                <!-- a hash route of this catalog, not a SvelteKit route -->
                <!-- eslint-disable svelte/no-navigation-without-resolve -->
                <a
                  href={formatHash('detail', entry.path, PROPS)}
                  aria-current={active === PROPS ? 'location' : undefined}>{t.props}</a
                >
                <!-- eslint-enable svelte/no-navigation-without-resolve -->
              </li>
            {/if}
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

<style>
  h1 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0 0 8px;
    font-size: 24px;
    overflow-wrap: anywhere;
  }

  .edit {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 0 0 16px;
    color: var(--_muted);
    font-size: 13px;
  }

  .edit button {
    padding: 2px 8px;
    border: 1px solid var(--_border);
    border-radius: 6px;
    background: var(--_bg);
    color: var(--_text);
    font-family: var(--_mono);
    font-size: 12px;
    cursor: pointer;
  }

  .edit button:hover {
    border-color: var(--_accent);
  }

  .dir {
    color: var(--_muted);
    font-size: 14px;
    font-weight: normal;
    overflow-wrap: anywhere;
  }

  h2 {
    margin: 32px 0 10px;
    font-size: 18px;
    overflow-wrap: anywhere;
  }

  /* focused only to move the keyboard's starting point, like main */
  h2:focus {
    outline: none;
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
    overflow-wrap: anywhere;
  }

  .doc :global(:is(p, ul, ol, pre, .table, blockquote)) {
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

  .doc :global(.table) {
    overflow-x: auto;
  }

  /* breaks only between words and scrolls past that, rather than breaking every word */
  .doc :global(table) {
    border-collapse: collapse;
    overflow-wrap: normal;
  }

  /* inside, as the scroll box clips what is drawn outside the table */
  .doc :global(table:focus-visible) {
    outline-offset: -2px;
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
    container-type: inline-size;
    overflow-x: auto;
  }

  /* too narrow for four columns: each prop stacks, with the type and default labelled on one line */
  @container (width < 520px) {
    .props :is(table, tbody, tr, td) {
      display: block;
    }

    .props thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }

    .props tr {
      padding: 10px 0;
      border-bottom: 1px solid var(--_border);
    }

    /* beats the four-column rules for cells below */
    .props tr td {
      padding: 2px 0;
      border: 0;
      white-space: normal;
    }

    .props td[data-label] {
      display: inline-block;
      margin-right: 16px;
    }

    .props td[data-label]:not(:empty)::before {
      content: attr(data-label) ' ';
      color: var(--_muted);
      font-size: 12px;
    }

    /* hidden by sight only: a screen reader still finds every row's four cells */
    .props td:empty {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
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

  .type-part {
    white-space: nowrap;
  }

  .props .name {
    font-weight: 600;
  }

  .flag {
    display: inline-block;
    margin-left: 6px;
    padding: 0 6px;
    border: 1px solid;
    border-radius: 999px;
    font-size: 11px;
    line-height: 16px;
    vertical-align: 1px;
  }

  .required {
    color: var(--_danger);
  }

  .bindable {
    color: var(--_accent);
  }

  .props-type {
    margin: 0 0 8px;
    color: var(--_muted);
    font-size: 14px;
    overflow-wrap: anywhere;
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
    overflow-wrap: anywhere;
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
