import { describe, expect, it } from 'vitest';
import { META, generateCatalogModule, generateEntryModule, metaId, pathOfMeta } from './virtual.js';

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
    expect(code).toContain('wrapper: () => import("/x/Wrapper.svelte")');
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

  it('passes null without a logo or a wrapper', () => {
    const code = generateEntryModule({ ...base, logo: null, wrapper: null });
    expect(code).not.toContain('?url');
    expect(code).toContain('logo: null');
    expect(code).toContain('wrapper: null');
  });

  it('passes the searched places', () => {
    const searched = [{ group: 'ui', dirs: ['src', '../outside'] }];
    const code = generateEntryModule({ ...base, logo: null, wrapper: null, searched });
    expect(code).toContain('searched: [{"group":"ui","dirs":["src","../outside"]}]');
  });
});
