import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePath, searchForWorkspaceRoot } from 'vite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as api from './index.js';
import { zukan } from './index.js';
import { detectSvelteKit } from './kit.js';
import { createMatchers, escapeRegExp } from './matchers.js';
import { extendFsAllow, libDir, resolveOptions } from './options.js';
import { ENTRY, generateCatalogModule, generateEntryModule } from './virtual.js';

// hooks are called with hand-made fakes, so the plugin is typed loosely
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const plugin = zukan() as any;
// transformZukan escapes "<" as < in the injected JSON
const h1 = '\\u003ch1>Foo\\u003c/h1>';
const source = '<Section title="Foo"><div>x</div></Section>';

let dir: string;
let zukanFile: string;
let docFile: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'zukan-'));
  zukanFile = path.join(dir, 'Foo.zukan.svelte');
  docFile = path.join(dir, 'Foo.zukan.md');
  await writeFile(zukanFile, source);
  await writeFile(docFile, '# Foo');
  await writeFile(path.join(dir, 'Foo.catalog.md'), '# Foo');
});

const transform = (code: string, id: string, p = plugin, ctx = { addWatchFile: vi.fn() }) =>
  p.transform.handler.call(ctx, code, id);

describe('createMatchers', () => {
  it('matches catalog files, with or without a query', () => {
    const { isCatalogId } = createMatchers('zukan');
    expect(isCatalogId('/a/Foo.zukan.svelte')).toBe(true);
    expect(isCatalogId('/a/Foo.zukan.svelte?v=1')).toBe(true);
  });

  it('rejects style modules, virtual modules and other files', () => {
    const { isCatalogId } = createMatchers('zukan');
    expect(isCatalogId('/a/Foo.zukan.svelte?svelte&type=style&lang.css')).toBe(false);
    expect(isCatalogId('\0/a/Foo.zukan.svelte')).toBe(false);
    expect(isCatalogId('/a/Foo.svelte')).toBe(false);
  });

  it('follows the suffix', () => {
    const { isCatalogId, isCatalogFile, isDocFile } = createMatchers('catalog');
    expect(isCatalogId('/a/Foo.catalog.svelte')).toBe(true);
    expect(isCatalogId('/a/Foo.zukan.svelte')).toBe(false);
    expect(isCatalogFile('/a/Foo.catalog.svelte')).toBe(true);
    expect(isCatalogFile('/a/Foo.zukan.svelte')).toBe(false);
    expect(isDocFile('/a/Foo.catalog.md')).toBe(true);
    expect(isDocFile('/a/Foo.zukan.md')).toBe(false);
    expect(isDocFile('/a/Document.md')).toBe(false);
  });

  it('maps catalog files and doc files one to one', () => {
    const { docFileOf, catalogFileOf } = createMatchers('zukan');
    expect(docFileOf('/a/Foo.zukan.svelte')).toBe('/a/Foo.zukan.md');
    expect(catalogFileOf('/a/Foo.zukan.md')).toBe('/a/Foo.zukan.svelte');
  });

  it('escapes regex metacharacters', () => {
    const re = new RegExp(`^${escapeRegExp('a.b*')}$`);
    expect(re.test('a.b*')).toBe(true);
    expect(re.test('axbb')).toBe(false);
  });

  it('is case-sensitive, using the suffix verbatim', () => {
    const { isCatalogId, isCatalogFile } = createMatchers('zukan');
    expect(isCatalogId('/a/Foo.ZUKAN.svelte')).toBe(false);
    expect(isCatalogFile('/a/Foo.ZUKAN.svelte')).toBe(false);
  });

  it.each(['a.b', '', 'a b', 'a|b'])('rejects invalid suffix %j', (suffix) => {
    expect(() => createMatchers(suffix)).toThrow(/suffix/);
    expect(() => zukan({ suffix })).toThrow(/suffix/);
  });
});

describe('transform', () => {
  it('uses a hook filter', () => {
    expect(plugin.name).toBe('vite-plugin-svelte-zukan');
    expect(plugin.enforce).toBe('pre');
    expect(plugin.transform.filter.id).toHaveProperty('include');
    expect(plugin.transform.filter.id).toHaveProperty('exclude');
  });

  it('filter agrees with isCatalogId', () => {
    const { isCatalogId } = createMatchers('zukan');
    const { include, exclude } = plugin.transform.filter.id as { include: RegExp; exclude: RegExp[] };
    const ids = [
      '/a/Foo.zukan.svelte',
      '/a/Foo.zukan.svelte?v=1',
      '/a/Foo.zukan.svelte#x',
      '/a/Foo.zukan.svelte?svelte&type=style&lang.css',
      '/a/Foo.zukan.svelte?foo&svelte&type=style',
      '\0/a/Foo.zukan.svelte',
      '/a/Foo.svelte',
      '/a/Foo.zukan.svelte.ts',
      '/a/Foo.catalog.svelte',
      '/a/Foo.zukan.md'
    ];
    for (const id of ids) {
      expect(include.test(id) && !exclude.some((r) => r.test(id)), id).toBe(isCatalogId(id));
    }
  });

  it('injects doc html', () => {
    const ctx = { addWatchFile: vi.fn() };
    const result = transform(source, zukanFile, plugin, ctx);
    expect(result.code).toContain(h1);
    expect(result.map).toBeDefined();
    expect(ctx.addWatchFile).toHaveBeenCalledWith(docFile);
  });

  it('reads Foo.<suffix>.md for a custom suffix', () => {
    const catalog = zukan({ suffix: 'catalog' }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const ctx = { addWatchFile: vi.fn() };
    const result = transform(source, path.join(dir, 'Foo.catalog.svelte'), catalog, ctx);
    expect(result.code).toContain(h1);
    expect(ctx.addWatchFile).toHaveBeenCalledWith(path.join(dir, 'Foo.catalog.md'));
  });

  it('doc is null without Foo.zukan.md', async () => {
    const other = await mkdtemp(path.join(tmpdir(), 'zukan-'));
    const ctx = { addWatchFile: vi.fn() };
    const result = transform(source, path.join(other, 'Foo.zukan.svelte'), plugin, ctx);
    expect(result.code).toContain('"doc":null');
    expect(ctx.addWatchFile).not.toHaveBeenCalled();
  });

  it('handler ignores non-catalog ids', () => {
    expect(transform(source, '/a/Foo.svelte')).toBeUndefined();
  });

  it('strips query from id', () => {
    const ctx = { addWatchFile: vi.fn() };
    const result = transform(source, `${zukanFile}?v=123`, plugin, ctx);
    expect(result.code).toContain(h1);
    expect(ctx.addWatchFile).toHaveBeenCalledWith(docFile);
  });
});

describe('hotUpdate', () => {
  const setup = (consumer: 'client' | 'server', found: Set<unknown> | null = new Set([{ id: 'mod' }])) => {
    const ctx = {
      environment: {
        config: { consumer },
        hot: { send: vi.fn() },
        moduleGraph: {
          getModulesByFile: vi.fn(() => found ?? undefined),
          invalidateModule: vi.fn()
        }
      }
    };
    const run = (type: string, file: string, modules: unknown[] = []) =>
      plugin.hotUpdate.call(ctx, { type, file, modules, timestamp: 1 });
    return { ctx, run, mod: [...(found ?? [])][0] };
  };

  it.each(['create', 'update', 'delete'])('invalidates the catalog file on %s of its .md', (type) => {
    const { mod, ctx, run } = setup('client');
    expect(run(type, docFile)).toEqual([]);
    expect(ctx.environment.moduleGraph.getModulesByFile).toHaveBeenCalledWith(normalizePath(zukanFile));
    expect(ctx.environment.moduleGraph.invalidateModule.mock.calls[0][0]).toBe(mod);
    expect(ctx.environment.hot.send).toHaveBeenCalledWith({ type: 'custom', event: 'zukan:reload' });
    expect(ctx.environment.hot.send).not.toHaveBeenCalledWith({ type: 'full-reload' });
  });

  it('does not throw when the catalog file is not in the module graph', () => {
    const { ctx, run } = setup('client', null);
    expect(run('create', docFile)).toEqual([]);
    expect(ctx.environment.moduleGraph.invalidateModule).not.toHaveBeenCalled();
  });

  it('reloads on catalog file update', () => {
    const { mod, ctx, run } = setup('client');
    expect(run('update', zukanFile, [mod])).toEqual([]);
    expect(ctx.environment.moduleGraph.invalidateModule.mock.calls[0][0]).toBe(mod);
    expect(ctx.environment.hot.send).toHaveBeenCalledWith({ type: 'custom', event: 'zukan:reload' });
  });

  it('server environment invalidates without sending', () => {
    const { ctx, run } = setup('server');
    run('update', docFile);
    expect(ctx.environment.moduleGraph.invalidateModule).toHaveBeenCalled();
    expect(ctx.environment.hot.send).not.toHaveBeenCalled();
  });

  it('ignores unrelated files, including the old Document.md', () => {
    const { ctx, run } = setup('client');
    expect(run('update', path.join(dir, 'Button.svelte'))).toBeUndefined();
    expect(run('update', path.join(dir, 'zukan', 'Document.md'))).toBeUndefined();
    expect(ctx.environment.moduleGraph.invalidateModule).not.toHaveBeenCalled();
    expect(ctx.environment.hot.send).not.toHaveBeenCalled();
  });
});

// a temporary app: <tmp>/app/src/A.zukan.svelte, <tmp>/outside/B.zukan.svelte
const makeApp = async () => {
  const tmp = realpathSync(await mkdtemp(path.join(tmpdir(), 'zukan-app-')));
  const root = normalizePath(path.join(tmp, 'app'));
  const outside = normalizePath(path.join(tmp, 'outside'));
  mkdirSync(path.join(root, 'src'), { recursive: true });
  mkdirSync(outside);
  await writeFile(path.join(tmp, 'pnpm-workspace.yaml'), '');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'app' }));
  await writeFile(path.join(root, 'src/A.zukan.svelte'), source);
  await writeFile(path.join(outside, 'B.zukan.svelte'), source);
  await writeFile(path.join(root, 'Wrapper.svelte'), '');
  await writeFile(path.join(root, 'logo.png'), '');
  return { tmp: normalizePath(tmp), root, outside };
};

// runs the hooks Vite calls before the server starts
const boot = (root: string, options: Parameters<typeof zukan>[0] = {}, allow?: string[]) => {
  const p = zukan(options) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const config: { root: string; server?: { fs?: { allow?: string[] } } } = {
    root,
    ...(allow && { server: { fs: { allow } } })
  };
  p.config.handler(config, { command: 'serve', mode: 'development' });
  return { p, config };
};

// runs the config hook of `vite build` and returns what it adds
const bootBuild = async (root: string, options: Parameters<typeof zukan>[0] = {}, user: object = {}) => {
  const p = zukan(options) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = { root, ...user };
  const added = await p.config.handler(config, { command: 'build', mode: 'production' });
  return { p, added, config };
};

const fakeServer = (root: string, base = '/') => ({
  config: { root, base, logger: { info: vi.fn() } },
  middlewares: { use: vi.fn() },
  watcher: { add: vi.fn() },
  transformIndexHtml: vi.fn(async (_url: string, html: string) => html),
  printUrls: vi.fn(),
  resolvedUrls: null as null | { local: string[]; network: string[] }
});

const bundled = (file: string) => normalizePath(fileURLToPath(new URL(`../app/${file}`, import.meta.url)));

describe('generateCatalogModule', () => {
  it('lists items with lazy imports', () => {
    const code = generateCatalogModule([
      { group: '@acme/ui', name: 'Card', dir: 'lib', path: '@acme/ui/lib/Card', file: '/abs/Card.zukan.svelte' }
    ]);
    expect(code).toContain('import("/abs/Card.zukan.svelte")');
    expect(code).toContain('"path":"@acme/ui/lib/Card"');
    expect(code).toContain('export const catalog');
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

describe('resolveOptions', () => {
  it('fills in defaults', async () => {
    const { root } = await makeApp();
    expect(resolveOptions(root, {})).toEqual({
      suffix: 'zukan',
      groups: undefined,
      wrapper: null,
      logo: bundled('logo.svg'),
      title: 'zukan',
      locale: 'en',
      build: false
    });
  });

  it('resolves files from the root, and logo: false hides the logo', async () => {
    const { root } = await makeApp();
    expect(resolveOptions(root, { wrapper: 'Wrapper.svelte', logo: './logo.png' })).toMatchObject({
      wrapper: `${root}/Wrapper.svelte`,
      logo: `${root}/logo.png`
    });
    expect(resolveOptions(root, { logo: false }).logo).toBeNull();
  });

  it('rejects bad values', async () => {
    const { root } = await makeApp();
    // @ts-expect-error unknown locale
    expect(() => resolveOptions(root, { locale: 'fr' })).toThrow(/locale "fr"/);
    expect(() => resolveOptions(root, { suffix: 'a.b' })).toThrow(/suffix/);
    expect(() => resolveOptions(root, { wrapper: 'Nope.svelte' })).toThrow(`wrapper not found: ${root}/Nope.svelte`);
    expect(() => resolveOptions(root, { logo: 'nope.svg' })).toThrow(`logo not found: ${root}/nope.svg`);
    // directories are not files
    expect(() => resolveOptions(root, { wrapper: '' })).toThrow(`wrapper not found: ${root}`);
    expect(() => resolveOptions(root, { logo: 'src' })).toThrow(`logo not found: ${root}/src`);
  });
});

describe('extendFsAllow', () => {
  it('leaves allow alone when every dir is inside the root', async () => {
    const { root } = await makeApp();
    expect(extendFsAllow(root, [`${root}/src`], ['/x'])).toBeUndefined();
  });

  it('adds the workspace root, the existing allow and the dirs outside the root', async () => {
    const { tmp, root, outside } = await makeApp();
    const ws = searchForWorkspaceRoot(root);
    // inside the workspace still counts: SvelteKit sets an explicit allow list without the workspace root
    expect(normalizePath(ws)).toBe(tmp);
    expect(extendFsAllow(root, [`${root}/src`, outside], ['/x'])).toEqual([ws, '/x', outside]);
    expect(extendFsAllow(root, [outside], undefined)).toEqual([ws, outside]);
  });

  it('is applied in the config hook', async () => {
    const { root, outside } = await makeApp();
    const ws = searchForWorkspaceRoot(root);
    // the library itself (src/lib here) is outside the temporary root
    expect(boot(root).config.server?.fs?.allow).toEqual([ws, libDir]);
    const { config } = boot(root, { groups: { a: 'src', b: '../outside' } }, ['/x']);
    expect(config.server?.fs?.allow).toEqual([ws, '/x', outside, libDir]);
  });

  it('adds the dirs of a wrapper and a logo outside the root', async () => {
    const { root, outside } = await makeApp();
    const assets = normalizePath(path.join(outside, 'assets'));
    mkdirSync(assets);
    await writeFile(path.join(outside, 'W.svelte'), '');
    await writeFile(path.join(assets, 'logo.svg'), '');
    const ws = searchForWorkspaceRoot(root);
    const { config } = boot(root, { wrapper: '../outside/W.svelte', logo: '../outside/assets/logo.svg' });
    expect(config.server?.fs?.allow).toEqual([ws, libDir, outside, assets]);
    // inside the root, nothing is added for them
    expect(boot(root, { wrapper: 'Wrapper.svelte', logo: 'logo.png' }).config.server?.fs?.allow).toEqual([ws, libDir]);
  });

  it('leaves allow alone when everything is inside the root', () => {
    const repo = normalizePath(path.resolve(libDir, '../..'));
    expect(boot(repo, { groups: { a: 'src' } }).config.server).toBeUndefined();
  });
});

describe('virtual modules', () => {
  it('resolves and loads the entry and the catalog', async () => {
    const { root } = await makeApp();
    const { p } = boot(root);
    expect(p.resolveId('virtual:svelte-zukan/entry')).toBe('\0virtual:svelte-zukan/entry');
    expect(p.resolveId('virtual:svelte-zukan/catalog')).toBe('\0virtual:svelte-zukan/catalog');
    expect(p.resolveId('virtual:svelte-zukan/other')).toBeUndefined();
    expect(p.load('\0virtual:svelte-zukan/catalog')).toContain(`import("${root}/src/A.zukan.svelte")`);
    const entry = p.load('\0virtual:svelte-zukan/entry');
    expect(entry).toContain(`import("${bundled('App.svelte')}")`);
    expect(entry).toContain(`import logo from "${bundled('logo.svg')}?url"`);
    expect(entry).toContain('searched: [{"group":"app","dirs":["src"]}]');
  });

  it('passes the searched dirs relative to the root', async () => {
    const { tmp, root } = await makeApp();
    const { p } = boot(root, { groups: { a: '.', b: ['src', '../outside'] } });
    const entry = p.load('\0virtual:svelte-zukan/entry');
    expect(entry).toContain('searched: [{"group":"a","dirs":["."]},{"group":"b","dirs":["src","../outside"]}]');
    expect(entry).not.toContain(tmp);
  });
});

describe('configureServer', () => {
  type Res = { status?: string | number; body?: string; type?: string; location?: string };
  const request = (mw: (...a: unknown[]) => void, url: string) =>
    new Promise<Res>((resolve) => {
      const out: Res = {};
      const res = {
        statusCode: 200,
        setHeader: (k: string, v: string) => {
          if (k.toLowerCase() === 'content-type') out.type = v;
          if (k.toLowerCase() === 'location') out.location = v;
        },
        end(body?: string) {
          resolve({ ...out, ...(this.statusCode !== 200 && { status: this.statusCode }), body });
        }
      };
      mw({ url }, res, () => resolve({ status: 'next' }));
    });

  it('serves the catalog HTML at /__zukan/', async () => {
    const { root } = await makeApp();
    const { p } = boot(root, { title: 'My UI', locale: 'ja' });
    const server = fakeServer(root);
    p.configureServer(server);
    const mw = server.middlewares.use.mock.calls[0][0];
    for (const url of ['/__zukan/', '/__zukan/?x', '/__zukan/?y#z']) {
      const res = await request(mw, url);
      expect(res.type).toMatch(/^text\/html/);
      expect(res.body).toContain('<html lang="ja">');
      expect(res.body).toContain('<title>My UI</title>');
      expect(res.body).toContain('src="/@id/__x00__virtual:svelte-zukan/entry"');
    }
    // the query is dropped
    for (const [url] of server.transformIndexHtml.mock.calls) expect(url).toBe('/__zukan/');
    for (const url of ['/', '/__zukanx', '/__zukan/x']) expect(await request(mw, url)).toEqual({ status: 'next' });
  });

  it('follows base', async () => {
    const { root } = await makeApp();
    const server = fakeServer(root, '/app/');
    boot(root).p.configureServer(server);
    const mw = server.middlewares.use.mock.calls[0][0];
    expect((await request(mw, '/app/__zukan/')).body).toContain('<html');
    expect(await request(mw, '/__zukan/')).toEqual({ status: 'next' });
  });

  it.each([
    ['/', '/__zukan', '/__zukan/'],
    ['/', '/__zukan?a=1', '/__zukan/?a=1'],
    ['/app/', '/app/__zukan', '/app/__zukan/'],
    ['/app/', '/app/__zukan?a=1', '/app/__zukan/?a=1']
  ])('redirects with base %s from %s to %s', async (base, url, location) => {
    const { root } = await makeApp();
    const server = fakeServer(root, base);
    boot(root).p.configureServer(server);
    const mw = server.middlewares.use.mock.calls[0][0];
    expect(await request(mw, url)).toMatchObject({ status: 302, location });
  });

  it('watches only the dirs outside the root', async () => {
    const { root, outside } = await makeApp();
    const server = fakeServer(root);
    boot(root, { groups: { a: 'src', b: '../outside' } }).p.configureServer(server);
    expect(server.watcher.add).toHaveBeenCalledTimes(1);
    expect(server.watcher.add).toHaveBeenCalledWith([outside]);
  });

  it('prints the catalog URL after the server URLs', async () => {
    const { root } = await makeApp();
    const server = fakeServer(root, '/app/');
    const original = server.printUrls;
    boot(root).p.configureServer(server);
    server.resolvedUrls = { local: ['http://localhost:5173/app/'], network: [] };
    server.printUrls();
    expect(original).toHaveBeenCalled();
    expect(server.config.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:5173/app/__zukan/')
    );
  });
});

describe('hotUpdate of the catalog list', () => {
  const setup = async (consumer: 'client' | 'server' = 'client') => {
    const { root, outside } = await makeApp();
    const { p } = boot(root);
    const catalogMod = { id: '\0virtual:svelte-zukan/catalog' };
    const ctx = {
      environment: {
        config: { consumer },
        hot: { send: vi.fn() },
        moduleGraph: {
          getModuleById: vi.fn((id: string) => (id === catalogMod.id ? catalogMod : undefined)),
          getModulesByFile: vi.fn(() => undefined),
          invalidateModule: vi.fn()
        }
      }
    };
    const run = (type: string, file: string) => p.hotUpdate.call(ctx, { type, file, modules: [], timestamp: 1 });
    return { root, outside, ctx, run, catalogMod };
  };

  it.each(['create', 'delete'])('invalidates the list on %s inside a scanned dir', async (type) => {
    const { root, ctx, run, catalogMod } = await setup();
    expect(run(type, `${root}/src/lib/New.zukan.svelte`)).toEqual([]);
    expect(ctx.environment.moduleGraph.invalidateModule.mock.calls[0][0]).toBe(catalogMod);
    expect(ctx.environment.hot.send).toHaveBeenCalledWith({ type: 'custom', event: 'zukan:reload' });
    expect(ctx.environment.hot.send).not.toHaveBeenCalledWith({ type: 'full-reload' });
  });

  it('server environment invalidates without sending', async () => {
    const { root, ctx, run } = await setup('server');
    run('create', `${root}/src/New.zukan.svelte`);
    expect(ctx.environment.moduleGraph.invalidateModule).toHaveBeenCalled();
    expect(ctx.environment.hot.send).not.toHaveBeenCalled();
  });

  it('ignores files created outside the scanned dirs', async () => {
    const { root, outside, ctx, run } = await setup();
    expect(run('create', `${outside}/New.zukan.svelte`)).toBeUndefined();
    expect(run('create', `${root}/New.zukan.svelte`)).toBeUndefined();
    expect(run('create', `${root}/src-other/New.zukan.svelte`)).toBeUndefined();
    expect(ctx.environment.moduleGraph.invalidateModule).not.toHaveBeenCalled();
    expect(ctx.environment.hot.send).not.toHaveBeenCalled();
  });
});

describe('detectSvelteKit', () => {
  it('finds sveltekit() in nested arrays and promises', async () => {
    expect(await detectSvelteKit([Promise.resolve([{ name: 'vite-plugin-sveltekit-setup' }])])).toBe(true);
    expect(await detectSvelteKit([[{ name: 'vite-plugin-svelte' }], null, false])).toBe(false);
    expect(await detectSvelteKit([])).toBe(false);
  });
});

describe('build', () => {
  it('normalizes the option', async () => {
    const { root } = await makeApp();
    expect(resolveOptions(root, {}).build).toBe(false);
    expect(resolveOptions(root, { build: false }).build).toBe(false);
    expect(resolveOptions(root, { build: true }).build).toBe(`${root}/zukan-dist`);
    expect(resolveOptions(root, { build: {} }).build).toBe(`${root}/zukan-dist`);
    expect(resolveOptions(root, { build: { outDir: 'out/catalog' } }).build).toBe(`${root}/out/catalog`);
  });

  it('rejects a catalog outDir that is the root or overlaps the app outDir', async () => {
    const { root, tmp } = await makeApp();
    const reject = (outDir: string, user: object = {}) =>
      expect(bootBuild(root, { build: { outDir } }, user)).rejects.toThrow(
        /svelte-zukan: build\.outDir of the catalog/
      );
    await reject('.');
    await reject(tmp);
    // the app's default outDir is dist
    await reject('dist');
    await reject('dist/zukan');
    await reject('out', { build: { outDir: 'out/app' } });
    await reject('out/zukan', { build: { outDir: 'out' } });
    // SvelteKit sets an absolute outDir
    await reject('.svelte-kit/output/zukan', { build: { outDir: `${root}/.svelte-kit/output` } });
    expect((await bootBuild(root, { build: { outDir: 'out' } }, { build: { outDir: 'output' } })).added).toBeDefined();
  });

  it('runs the config hook after the other plugins', () => {
    // so that a `builder` or a `renderBuiltUrl` set by another plugin is seen
    expect(plugin.config.order).toBe('post');
  });

  it('adds nothing when disabled, when serving or on an SSR build', async () => {
    const { root } = await makeApp();
    expect((await bootBuild(root)).added).toBeUndefined();
    expect((await bootBuild(root, { build: false })).added).toBeUndefined();
    // step 2 of Vite's SSR build: `vite build --ssr src/entry-server.ts`
    const ssr = await bootBuild(root, { build: true }, { build: { ssr: 'src/entry-server.ts' } });
    expect(ssr.added).toBeUndefined();
    expect(ssr.config).not.toHaveProperty('experimental');
    const p = zukan({ build: true }) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(await p.config.handler({ root }, { command: 'serve', mode: 'development' })).toBeUndefined();
  });

  it('adds the zukan environment', async () => {
    const { root } = await makeApp();
    const { added } = await bootBuild(root, { build: { outDir: 'out/catalog' } });
    // plain `vite build` sets up only the client environment without `builder`
    expect(added.builder).toEqual({});
    expect(added.environments.zukan).toEqual({
      consumer: 'client',
      build: {
        outDir: `${root}/out/catalog`,
        manifest: false,
        copyPublicDir: false,
        rolldownOptions: {
          input: { zukan: 'virtual:svelte-zukan/entry' },
          output: {
            entryFileNames: '_zukan/[name]-[hash].js',
            chunkFileNames: '_zukan/[name]-[hash].js',
            assetFileNames: '_zukan/[name]-[hash][extname]'
          }
        }
      }
    });
    expect((await bootBuild(root, { build: true })).added.environments.zukan.build.outDir).toBe(`${root}/zukan-dist`);
  });

  it('defines the SvelteKit globals only with SvelteKit', async () => {
    const { root } = await makeApp();
    const kit = [Promise.resolve([{ name: 'vite-plugin-sveltekit-setup' }])];
    const { added } = await bootBuild(root, { build: true }, { plugins: kit });
    expect(added.environments.zukan.define).toEqual({
      __SVELTEKIT_PAYLOAD__: 'undefined',
      __SVELTEKIT_HAS_SERVER_LOAD__: 'false',
      __SVELTEKIT_HAS_UNIVERSAL_LOAD__: 'false'
    });
    const plain = await bootBuild(root, { build: true }, { plugins: [{ name: 'vite-plugin-svelte' }] });
    expect(plain.added.environments.zukan).not.toHaveProperty('define');
  });

  it('keeps the app build settings out of the zukan environment', async () => {
    const { root } = await makeApp();
    const { p } = await bootBuild(root, { build: true });
    const inherited = () => ({
      build: {
        ssr: 'src/entry-server.ts',
        lib: { entry: 'src/index.ts' },
        rolldownOptions: { input: { main: 'index.html', nested: 'nested/index.html', zukan: ENTRY } }
      }
    });
    const env = inherited();
    p.configEnvironment('zukan', env);
    expect(env.build).toEqual({ ssr: false, lib: false, rolldownOptions: { input: { zukan: ENTRY } } });
    const client = inherited();
    p.configEnvironment('client', client);
    expect(client).toEqual(inherited());
  });

  it('makes the URLs of the catalog files relative, and leaves the others to the existing renderBuiltUrl', async () => {
    const { root } = await makeApp();
    const ctx = { hostId: 'assets/index.js', hostType: 'js', type: 'asset', ssr: false };
    const own = vi.fn(() => 'https://cdn.example/x.js');
    const { config } = await bootBuild(root, { build: true }, { experimental: { renderBuiltUrl: own } });
    const render = config.experimental.renderBuiltUrl;
    expect(render('_zukan/App-1.js', { ...ctx, hostId: '_zukan/zukan-1.js' })).toEqual({ relative: true });
    expect(render('_zukan/App-1.css', ctx)).toEqual({ relative: true });
    expect(own).not.toHaveBeenCalled();
    expect(render('assets/index-1.js', ctx)).toBe('https://cdn.example/x.js');
    expect(own).toHaveBeenCalledWith('assets/index-1.js', ctx);
    // without one, the app's files get Vite's default
    const plain = await bootBuild(root, { build: true });
    expect(plain.config.experimental.renderBuiltUrl('assets/index-1.js', ctx)).toBeUndefined();
  });

  type Env = { isBuilt: boolean };
  const fakeBuilder = (fileName: string, others: Record<string, Env>, { array = false, watch = false } = {}) => {
    const zukanEnv = { isBuilt: false };
    const output = {
      output: [
        // an entry of the app's own input that leaked in would also be an entry
        { type: 'chunk', isEntry: true, name: 'main', fileName: '_zukan/main-1.js' },
        { type: 'chunk', isEntry: false, name: 'App', fileName: '_zukan/App-1.js' },
        { type: 'chunk', isEntry: true, name: 'zukan', fileName }
      ]
    };
    const builder = {
      config: { build: { watch: watch ? {} : null }, logger: { warn: vi.fn() } },
      environments: { zukan: zukanEnv, ...others } as Record<string, Env>,
      build: vi.fn(async (env: Env) => {
        env.isBuilt = true;
        return env === zukanEnv ? (array ? [output] : output) : { output: [] };
      })
    };
    return { builder, zukanEnv };
  };

  it('runs after the other buildApp hooks', () => {
    expect(plugin.buildApp.order).toBe('post');
  });

  it('builds nothing when disabled', async () => {
    const { root } = await makeApp();
    const { p } = await bootBuild(root, { build: false });
    const { builder } = fakeBuilder('_zukan/zukan-abc.js', { client: { isBuilt: false } });
    delete builder.environments.zukan;
    await p.buildApp.handler(builder);
    expect(builder.build).not.toHaveBeenCalled();
  });

  it.each([false, true])('writes index.html with a relative script (array output: %s)', async (array) => {
    const { root } = await makeApp();
    const outDir = `${root}/zukan-dist`;
    mkdirSync(`${outDir}/_app`, { recursive: true });
    await writeFile(`${outDir}/_app/version.json`, '{}');
    const { p } = await bootBuild(root, { build: true, title: 'My UI', locale: 'ja' });
    const { builder, zukanEnv } = fakeBuilder('_zukan/zukan-abc.js', { client: { isBuilt: true } }, { array });
    await p.buildApp.handler(builder);
    expect(builder.build).toHaveBeenCalledTimes(1);
    expect(builder.build).toHaveBeenCalledWith(zukanEnv);
    const html = readFileSync(`${outDir}/index.html`, 'utf-8');
    expect(html).toContain('<script type="module" src="./_zukan/zukan-abc.js"></script>');
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain('<title>My UI</title>');
    expect(existsSync(`${outDir}/_app`)).toBe(false);
  });

  it('removes only version.json from _app when other files are there', async () => {
    const { root } = await makeApp();
    const outDir = `${root}/zukan-dist`;
    mkdirSync(`${outDir}/_app/immutable/workers`, { recursive: true });
    await writeFile(`${outDir}/_app/version.json`, '{}');
    await writeFile(`${outDir}/_app/immutable/workers/w.js`, '');
    const { p } = await bootBuild(root, { build: true });
    const { builder } = fakeBuilder('_zukan/zukan-abc.js', { client: { isBuilt: true } });
    await p.buildApp.handler(builder);
    expect(existsSync(`${outDir}/_app/version.json`)).toBe(false);
    expect(existsSync(`${outDir}/_app/immutable/workers/w.js`)).toBe(true);
  });

  it('skips the catalog with a warning in watch mode', async () => {
    const { root } = await makeApp();
    const { p } = await bootBuild(root, { build: true });
    const client = { isBuilt: false };
    const { builder } = fakeBuilder('_zukan/zukan-abc.js', { client }, { watch: true });
    await p.buildApp.handler(builder);
    expect(builder.build.mock.calls.map(([env]) => env)).toEqual([client]);
    expect(builder.config.logger.warn).toHaveBeenCalledWith(expect.stringMatching(/svelte-zukan: .*watch/));
  });

  // Vite builds the app only when no buildApp hook built an environment
  it.each([
    ['client', {}],
    ['every', { builder: {} }]
  ] as const)('builds the %s environment of the app first when no other hook did', async (which, user) => {
    const { root } = await makeApp();
    mkdirSync(`${root}/zukan-dist`);
    const { p } = await bootBuild(root, { build: true }, user);
    const client = { isBuilt: false };
    const server = { isBuilt: false };
    const { builder, zukanEnv } = fakeBuilder('_zukan/zukan-abc.js', { client, ssr: server });
    await p.buildApp.handler(builder);
    const app = { client: [client], every: [client, server] }[which];
    expect(builder.build.mock.calls.map(([env]) => env)).toEqual([...app, zukanEnv]);
  });
});

describe('public API', () => {
  it('exports only zukan', () => {
    expect(Object.keys(api)).toEqual(['zukan']);
  });
});
