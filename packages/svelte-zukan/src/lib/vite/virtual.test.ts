import { describe, expect, it } from 'vitest';
import {
  META,
  RELOAD_ON_PRELOAD_ERROR,
  TAILWIND,
  TAILWIND_SOURCE,
  generateCatalogModule,
  generateEntryModule,
  generateTailwindModule,
  metaId,
  pathOfMeta
} from './virtual.js';

describe('generateCatalogModule', () => {
  it('lists items with lazy imports', () => {
    const code = generateCatalogModule([
      { group: '@acme/ui', name: 'Card', dir: 'lib', path: '@acme/ui/lib/Card', file: '/abs/Card.zukan.svelte' }
    ]);
    expect(code).toContain('import("/abs/Card.zukan.svelte")');
    expect(code).toContain('"path":"@acme/ui/lib/Card"');
    expect(code).toContain('export const catalog');
    expect(code).toContain('export const uncataloged = [];');
    expect(generateCatalogModule([], [{ group: 'ui', file: 'src/lib/Card.svelte' }])).toContain(
      'export const uncataloged = [{"group":"ui","file":"src/lib/Card.svelte"}];'
    );
  });

  it('encodes the metadata ID so the dev server leaves it alone', () => {
    const path = '@acme/ui/lib/100%.css';
    const code = generateCatalogModule([
      { group: '@acme/ui', name: '100%.css', dir: 'lib', path, file: '/abs/x.zukan.svelte' }
    ]);
    const spec = code.match(/import\("(virtual:svelte-zukan\/meta\/[^"]+)"\)/)![1];
    expect(spec).toBe(metaId(path));
    expect(decodeURI(spec)).toBe(spec);
    expect(spec.slice(META.length)).toMatch(/^[0-9a-f]+$/);
    expect(pathOfMeta(spec.slice(META.length))).toBe(path);
  });
});

describe('generateEntryModule', () => {
  const base = { appFile: '/lib/app/App.svelte', title: 'zukan', locale: 'en' as const, searched: [] };

  it('imports the logo as a URL and the wrapper lazily', () => {
    const code = generateEntryModule({ ...base, logo: '/x/logo.svg', wrapper: '/x/Wrapper.svelte' });
    expect(code).toContain('import("/lib/app/App.svelte")');
    expect(code).toContain('import("virtual:svelte-zukan/catalog")');
    expect(code).toContain('import logo from "/x/logo.svg?url"');
    expect(code).toContain('import.meta.hot.accept("/x/logo.svg?url"');
    expect(code).toContain('wrapper: () => import("/x/Wrapper.svelte")');
  });

  it("sets SvelteKit's dev global before loading the app, only when given its name", () => {
    const code = generateEntryModule({ ...base, logo: null, wrapper: null, kitGlobal: '"__sveltekit_dev"' });
    expect(code.indexOf('globalThis["__sveltekit_dev"] = { env: {} };')).toBeGreaterThan(-1);
    expect(code.indexOf('globalThis["__sveltekit_dev"]')).toBeLessThan(code.indexOf('import("/lib/app/App.svelte")'));
    expect(generateEntryModule({ ...base, logo: null, wrapper: null })).not.toContain('globalThis[');
  });

  it('listens for zukan:reload before loading the app and the catalog', () => {
    const code = generateEntryModule({ ...base, logo: null, wrapper: null });
    const listen = code.indexOf("import.meta.hot.on('zukan:reload'");
    expect(listen).toBeGreaterThan(-1);
    expect(code).toContain('parent.location.pathname === location.pathname');
    expect(listen).toBeLessThan(code.indexOf('import("virtual:svelte-zukan/catalog")'));
    expect(listen).toBeLessThan(code.indexOf('import("/lib/app/App.svelte")'));
    expect(code).not.toMatch(/^import .* from "(virtual:svelte-zukan\/catalog|\/lib\/app\/App\.svelte)"/m);
  });

  it("adds the search shortcut's capture listener before loading the app, and hands it the mounted app", () => {
    const code = generateEntryModule({ ...base, logo: null, wrapper: null });
    const listen = code.indexOf("addEventListener('keydown'");
    expect(listen).toBeGreaterThan(-1);
    expect(code).toContain('app?.searchKey(e)');
    expect(code).toContain('}, { capture: true });');
    expect(listen).toBeLessThan(code.indexOf('import("/lib/app/App.svelte")'));
    expect(code).toContain('app = mount(App, {');
  });

  it('imports only the logo statically, so that its listener waits for no other module to load', () => {
    const code = generateEntryModule({ ...base, logo: '/x/logo.svg', wrapper: null, tailwind: true });
    expect(code.match(/^\s*import\s.*$/gm)).toEqual(['import logo from "/x/logo.svg?url";']);
    expect(code).toContain("import('svelte')");
    expect(generateEntryModule({ ...base, logo: null, wrapper: null })).not.toMatch(/^\s*import\s/m);
  });

  it('reloads a preview that failed to render on the next HMR update', () => {
    const code = generateEntryModule({ ...base, logo: null, wrapper: null });
    expect(code).toContain(
      "import.meta.hot.on('vite:afterUpdate', () => {\n  if (document.querySelector('[data-zukan-error]')) location.reload();"
    );
  });

  it('reloads on a preload error outside the dev-only block, before loading anything', () => {
    const code = generateEntryModule({ ...base, logo: null, wrapper: null });
    const listen = code.indexOf(RELOAD_ON_PRELOAD_ERROR);
    expect(listen).toBeGreaterThan(-1);
    expect(listen).toBeLessThan(code.indexOf('import.meta.hot'));
    expect(listen).toBeLessThan(code.indexOf('import("/lib/app/App.svelte")'));
    expect(RELOAD_ON_PRELOAD_ERROR).toContain("window.addEventListener('vite:preloadError'");
  });

  it('passes null without a logo or a wrapper', () => {
    const code = generateEntryModule({ ...base, logo: null, wrapper: null });
    expect(code).not.toContain('?url');
    expect(code).toContain('logo: null');
    expect(code).toContain('wrapper: null');
  });

  it('passes the fixed theme, or null to let the viewer switch', () => {
    expect(generateEntryModule({ ...base, logo: null, wrapper: null })).toContain('fixedTheme: null');
    expect(generateEntryModule({ ...base, logo: null, wrapper: null, theme: 'dark' })).toContain('fixedTheme: "dark"');
  });

  it('imports the Tailwind list only when there is Tailwind', () => {
    const without = generateEntryModule({ ...base, logo: null, wrapper: null });
    expect(without).not.toContain(TAILWIND);
    expect(without).toContain('tailwind: []');
    const code = generateEntryModule({ ...base, logo: null, wrapper: null, tailwind: true });
    expect(code).toContain(`import("${TAILWIND}")`);
    expect(code).toContain('{ catalog, uncataloged }, { tailwind }');
    expect(code).toMatch(/^ {6}tailwind,$/m);
  });

  it('passes the searched places', () => {
    const searched = [{ group: 'ui', dirs: ['src', '../outside'] }];
    const code = generateEntryModule({ ...base, logo: null, wrapper: null, searched });
    expect(code).toContain('searched: [{"group":"ui","dirs":["src","../outside"]}]');
  });
});

describe('generateTailwindModule', () => {
  it('lists the entries with their data loaded lazily', () => {
    const source = {
      id: 'abc123',
      file: 'src/app.css',
      version: '4.3.3',
      prefix: null,
      categories: [],
      variables: { '--color-x': 'red' },
      css: '.x{}'
    };
    const code = generateTailwindModule([source, { ...source, id: 'def456', file: 'src/b.css', error: 'boom' }]);
    expect(code).toContain('export const tailwind = [');
    expect(code).toContain('"id":"abc123","file":"src/app.css","error":null');
    expect(code).toContain('"id":"def456","file":"src/b.css","error":"boom"');
    expect(code).toContain(`load: () => import("${TAILWIND_SOURCE}abc123")`);
    // the data stays in the lazily loaded module
    expect(code).not.toContain('--color-x');
    expect(code).not.toContain('.x{}');
    expect(generateTailwindModule([])).toBe('export const tailwind = [\n\n];\n');
  });
});
