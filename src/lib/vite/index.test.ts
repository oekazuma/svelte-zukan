import { mkdirSync, realpathSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePath, searchForWorkspaceRoot } from 'vite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { extendFsAllow, generateCatalogModule, generateEntryModule, zukan } from './index.js';
import { createMatchers, escapeRegExp } from './matchers.js';
import { resolveOptions } from './options.js';

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
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'app' }));
  await writeFile(path.join(root, 'src/A.zukan.svelte'), source);
  await writeFile(path.join(outside, 'B.zukan.svelte'), source);
  await writeFile(path.join(root, 'Wrapper.svelte'), '');
  await writeFile(path.join(root, 'logo.png'), '');
  return { root, outside };
};

// runs the hooks Vite calls before the server starts
const boot = (root: string, options: Parameters<typeof zukan>[0] = {}) => {
  const p = zukan(options) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const config: { root: string; server?: { fs?: { allow?: string[] } } } = { root };
  p.config(config, { command: 'serve', mode: 'development' });
  p.configResolved({ root });
  return { p, config };
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
  const base = { appFile: '/lib/app/App.svelte', title: 'zukan', locale: 'en' as const };

  it('imports the logo as a URL and the wrapper lazily', () => {
    const code = generateEntryModule({ ...base, logo: '/x/logo.svg', wrapper: '/x/Wrapper.svelte' });
    expect(code).toContain('import App from "/lib/app/App.svelte"');
    expect(code).toContain('from "virtual:svelte-zukan/catalog"');
    expect(code).toContain('import logo from "/x/logo.svg?url"');
    expect(code).toContain('wrapper: () => import("/x/Wrapper.svelte")');
  });

  it('passes null without a logo or a wrapper', () => {
    const code = generateEntryModule({ ...base, logo: null, wrapper: null });
    expect(code).not.toContain('?url');
    expect(code).toContain('logo: null');
    expect(code).toContain('wrapper: null');
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
  });
});

describe('extendFsAllow', () => {
  it('leaves allow alone when every dir is inside the workspace', async () => {
    const { root } = await makeApp();
    expect(extendFsAllow(root, [`${root}/src`], ['/x'])).toBeUndefined();
  });

  it('adds the workspace root, the existing allow and the outside dirs', async () => {
    const { root, outside } = await makeApp();
    const ws = searchForWorkspaceRoot(root);
    expect(extendFsAllow(root, [`${root}/src`, outside], ['/x'])).toEqual([ws, '/x', outside]);
    expect(extendFsAllow(root, [outside], undefined)).toEqual([ws, outside]);
  });

  it('is applied in the config hook', async () => {
    const { root, outside } = await makeApp();
    expect(boot(root).config.server).toBeUndefined();
    const { config } = boot(root, { groups: { a: 'src', b: '../outside' } });
    expect(config.server?.fs?.allow).toEqual([searchForWorkspaceRoot(root), outside]);
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
    expect(entry).toContain(`import App from "${bundled('App.svelte')}"`);
    expect(entry).toContain(`import logo from "${bundled('logo.svg')}?url"`);
  });
});

describe('configureServer', () => {
  type Res = { status?: string; body?: string; type?: string };
  const request = (mw: (...a: unknown[]) => void, url: string) =>
    new Promise<Res>((resolve) => {
      const out: Res = {};
      const res = {
        setHeader: (k: string, v: string) => k.toLowerCase() === 'content-type' && (out.type = v),
        end: (body: string) => resolve({ ...out, body })
      };
      mw({ url }, res, () => resolve({ status: 'next' }));
    });

  it('serves the catalog HTML at /__zukan/', async () => {
    const { root } = await makeApp();
    const { p } = boot(root, { title: 'My UI', locale: 'ja' });
    const server = fakeServer(root);
    p.configureServer(server);
    const mw = server.middlewares.use.mock.calls[0][0];
    for (const url of ['/__zukan/', '/__zukan/?x']) {
      const res = await request(mw, url);
      expect(res.type).toMatch(/^text\/html/);
      expect(res.body).toContain('<html lang="ja">');
      expect(res.body).toContain('<title>My UI</title>');
      expect(res.body).toContain('src="/@id/__x00__virtual:svelte-zukan/entry"');
    }
    expect(server.transformIndexHtml).toHaveBeenCalledWith('/__zukan/', expect.any(String));
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
