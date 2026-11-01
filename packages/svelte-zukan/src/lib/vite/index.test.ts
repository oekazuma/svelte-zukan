import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { BuildEnvironment, normalizePath, resolveConfig, searchForWorkspaceRoot } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as api from './index.js';
import { zukan } from './index.js';
import { extendFsAllow, libDir, resolveOptions } from './options.js';
import { findPackage, loadTailwind } from './tailwind-load.js';
import { ENTRY, META, metaId } from './virtual.js';

vi.mock('./tailwind-load.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./tailwind-load.js')>();
  return { ...original, loadTailwind: vi.fn(original.loadTailwind) };
});

// hooks are called with hand-made fakes, so the plugin is typed loosely
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const plugin = zukan() as any;
const source = '<Section title="Foo"><div>x</div></Section>';

let dir: string;
let zukanFile: string;
let docFile: string;

/** every temp dir of this file lives here, so one afterAll removes them all */
let tmpRoot: string;

beforeAll(async () => {
  tmpRoot = realpathSync(await mkdtemp(path.join(tmpdir(), 'zukan-')));
  dir = path.join(tmpRoot, 'src');
  mkdirSync(dir);
  zukanFile = path.join(dir, 'Foo.zukan.svelte');
  docFile = path.join(dir, 'Foo.zukan.md');
  await writeFile(zukanFile, source);
  await writeFile(docFile, '# Foo');
  await plugin.config.handler({ root: tmpRoot }, { command: 'serve', mode: 'development' });
});

afterAll(() => rmSync(tmpRoot, { recursive: true, force: true }));

describe('hotUpdate', () => {
  const metaMod = { id: '\0virtual:svelte-zukan/meta/app%2FA' };
  const setup = (consumer: 'client' | 'server', metas: Map<string, unknown> = new Map([[metaMod.id, metaMod]])) => {
    const ctx = {
      environment: {
        config: { consumer },
        hot: { send: vi.fn() },
        moduleGraph: {
          idToModuleMap: metas,
          invalidateModule: vi.fn()
        }
      }
    };
    const run = (type: string, file: string, modules: unknown[] = []) =>
      plugin.hotUpdate.call(ctx, { type, file, modules, timestamp: 1 });
    return { ctx, run };
  };

  it.each(['create', 'update', 'delete'])('invalidates the metadata on %s of an .md', (type) => {
    const { ctx, run } = setup('client');
    expect(run(type, docFile)).toEqual([]);
    expect(ctx.environment.moduleGraph.invalidateModule.mock.calls[0][0]).toBe(metaMod);
    expect(ctx.environment.hot.send).toHaveBeenCalledWith({ type: 'custom', event: 'zukan:reload' });
    expect(ctx.environment.hot.send).not.toHaveBeenCalledWith({ type: 'full-reload' });
  });

  it('does not invalidate other modules of the graph', () => {
    const other = { id: '/a/Button.svelte' };
    const { ctx, run } = setup('client', new Map([[other.id, other]]));
    expect(run('create', docFile)).toEqual([]);
    expect(ctx.environment.moduleGraph.invalidateModule).not.toHaveBeenCalled();
  });

  it('server environment invalidates without sending', () => {
    const { ctx, run } = setup('server');
    run('update', docFile);
    expect(ctx.environment.moduleGraph.invalidateModule).toHaveBeenCalled();
    expect(ctx.environment.hot.send).not.toHaveBeenCalled();
  });

  it('ignores unrelated files, including the old Document.md and an .md outside the scanned dirs', () => {
    const { ctx, run } = setup('client');
    expect(run('update', path.join(tmpRoot, 'Foo.zukan.md'))).toBeUndefined();
    expect(run('update', path.join(dir, 'Button.svelte'))).toBeUndefined();
    expect(run('update', path.join(dir, 'zukan', 'Document.md'))).toBeUndefined();
    expect(ctx.environment.moduleGraph.invalidateModule).not.toHaveBeenCalled();
    expect(ctx.environment.hot.send).not.toHaveBeenCalled();
  });
});

// a temporary app: <tmp>/app/src/A.zukan.svelte, <tmp>/outside/B.zukan.svelte
const makeApp = async () => {
  const tmp = await mkdtemp(path.join(tmpRoot, 'app-'));
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

const fakeServer = (root: string, base = '/', headers?: Record<string, string | string[]>) => ({
  config: { root, base, logger: { info: vi.fn() }, server: { headers }, preview: { headers } },
  middlewares: { use: vi.fn() },
  watcher: { add: vi.fn() },
  transformIndexHtml: vi.fn(async (_url: string, html: string) => html),
  printUrls: vi.fn(),
  resolvedUrls: null as null | { local: string[]; network: string[] }
});

const bundled = (file: string) => normalizePath(fileURLToPath(new URL(`../app/${file}`, import.meta.url)));

describe('resolveOptions', () => {
  it('fills in defaults', async () => {
    const { root } = await makeApp();
    expect(resolveOptions(root, {})).toEqual({
      suffix: 'zukan',
      wrapper: null,
      logo: bundled('logo.svg'),
      title: 'zukan',
      locale: 'en',
      theme: null,
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
    // @ts-expect-error unknown theme
    expect(() => resolveOptions(root, { theme: 'blue' })).toThrow('unknown theme "blue" (use "light" or "dark")');
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

  it('keeps an explicit allow list and adds the dirs outside the root', async () => {
    const { tmp, root, outside } = await makeApp();
    const ws = searchForWorkspaceRoot(root);
    // an explicit list (SvelteKit's, or the user's) is kept as it is; the workspace root stands in only for Vite's default
    expect(normalizePath(ws)).toBe(tmp);
    expect(extendFsAllow(root, [`${root}/src`, outside], ['/x'])).toEqual(['/x', outside]);
    expect(extendFsAllow(root, [outside], undefined)).toEqual([ws, outside]);
  });

  it('is applied in the config hook', async () => {
    const { root, outside } = await makeApp();
    const ws = searchForWorkspaceRoot(root);
    // the library itself (src/lib here) is outside the temporary root
    expect(boot(root).config.server?.fs?.allow).toEqual([ws, libDir]);
    const { config } = boot(root, { groups: { a: 'src', b: '../outside' } }, ['/x']);
    expect(config.server?.fs?.allow).toEqual(['/x', outside, libDir]);
  });

  it('adds the dir of a wrapper and the logo file outside the root', async () => {
    const { root, outside } = await makeApp();
    const assets = normalizePath(path.join(outside, 'assets'));
    mkdirSync(assets);
    await writeFile(path.join(outside, 'W.svelte'), '');
    await writeFile(path.join(assets, 'logo.svg'), '');
    const ws = searchForWorkspaceRoot(root);
    const { config } = boot(root, { wrapper: '../outside/W.svelte', logo: '../outside/assets/logo.svg' });
    expect(config.server?.fs?.allow).toEqual([ws, libDir, outside, `${assets}/logo.svg`]);
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

  // imported by its file path it would be served under /public/, which Vite warns about on every request
  it('on the dev server, imports a logo in publicDir by its public URL', async () => {
    const { root } = await makeApp();
    mkdirSync(path.join(root, 'public/img'), { recursive: true });
    await writeFile(path.join(root, 'public/img/logo.svg'), '<svg/>');
    const { p } = boot(root, { logo: 'public/img/logo.svg' });
    p.configureServer({ ...fakeServer(root), config: { ...fakeServer(root).config, publicDir: `${root}/public` } });
    expect(p.load('\0virtual:svelte-zukan/entry')).toContain('import logo from "/img/logo.svg?url"');
    const built = (await bootBuild(root, { logo: 'public/img/logo.svg' })).p;
    expect(built.load('\0virtual:svelte-zukan/entry')).toContain(`import logo from "${root}/public/img/logo.svg?url"`);
  });

  it('passes the searched dirs relative to the root', async () => {
    const { tmp, root } = await makeApp();
    const { p } = boot(root, { groups: { a: '.', b: ['src', '../outside'] } });
    const entry = p.load('\0virtual:svelte-zukan/entry');
    expect(entry).toContain('searched: [{"group":"a","dirs":["."]},{"group":"b","dirs":["src","../outside"]}]');
    expect(entry).not.toContain(tmp);
  });
});

describe('metadata modules', () => {
  const meta = (path: string) => '\0' + metaId(path);

  it('resolves the metadata of an entry and lists it in the catalog', async () => {
    const { root } = await makeApp();
    const { p } = boot(root);
    expect(p.resolveId(metaId('app/A'))).toBe(meta('app/A'));
    expect(p.load('\0virtual:svelte-zukan/catalog')).toContain(`import("${metaId('app/A')}")`);
  });

  it('serves the source of axe-core as a string', async () => {
    const { root } = await makeApp();
    const { p } = boot(root);
    expect(p.resolveId('virtual:svelte-zukan/axe')).toBe('\0virtual:svelte-zukan/axe');
    const code: string = p.load('\0virtual:svelte-zukan/axe');
    expect(code.startsWith('export default "')).toBe(true);
    expect(code).toContain('axe.run');
    expect(code).not.toContain('axe.configure({ locale');
    const ja: string = boot(root, { locale: 'ja' }).p.load('\0virtual:svelte-zukan/axe');
    expect(ja).toContain('axe.configure({ locale');
  });

  it('exports the sections and no absolute path', async () => {
    const { tmp, root } = await makeApp();
    const { p } = boot(root);
    const addWatchFile = vi.fn();
    const code = p.load.call({ addWatchFile }, meta('app/A'));
    expect(code).toContain('"title":"Foo"');
    expect(code).toContain('"doc":null');
    expect(code).not.toContain(tmp);
    expect(addWatchFile).toHaveBeenCalledWith(`${root}/src/A.zukan.svelte`);
  });

  it('renders the .md next to the file and watches it', async () => {
    const { root } = await makeApp();
    await writeFile(path.join(root, 'src/A.zukan.md'), '# A');
    const { p } = boot(root);
    const addWatchFile = vi.fn();
    expect(p.load.call({ addWatchFile }, meta('app/A'))).toContain('<h1>A</h1>');
    expect(addWatchFile).toHaveBeenCalledWith(`${root}/src/A.zukan.md`);
  });

  // a case-insensitive filesystem finds both by the catalog file's own spelling
  it('reads neither an .md nor a component whose name differs only in case', async () => {
    const { root } = await makeApp();
    await writeFile(path.join(root, 'src/A.Zukan.md'), '# A');
    await writeFile(path.join(root, 'src/a.svelte'), '<script lang="ts">let { x }: { x: string } = $props();</script>');
    const { p } = boot(root);
    const code = p.load.call({ addWatchFile: vi.fn() }, meta('app/A'));
    expect(code).toContain('"doc":null');
    expect(code).toContain('"props":null');
  });

  it('renders an .md that starts with a byte order mark', async () => {
    const { root } = await makeApp();
    await writeFile(path.join(root, 'src/A.zukan.md'), '\uFEFF# A\r\n\r\ntext');
    const { p } = boot(root);
    expect(p.load.call({ addWatchFile: vi.fn() }, meta('app/A'))).toContain('<h1>A</h1>');
  });

  it('reads the props of the component next to the file without making it an import of the metadata', async () => {
    const { tmp, root } = await makeApp();
    const { p } = boot(root);
    expect(p.load.call({ addWatchFile: vi.fn() }, meta('app/A'))).toContain('"props":null,"propsType":null');
    await writeFile(
      path.join(root, 'src/A.svelte'),
      '<script lang="ts">\n  let { a = 1 }: { a?: number } = $props();\n</script>'
    );
    const addWatchFile = vi.fn();
    const code = p.load.call({ addWatchFile }, meta('app/A'));
    expect(code).toContain('"props":[{"name":"a","type":"number","default":"1"');
    expect(code).not.toContain(tmp);
    expect(addWatchFile).not.toHaveBeenCalledWith(`${root}/src/A.svelte`);
  });

  it('reads B.<suffix>.md for a custom suffix', async () => {
    const { root } = await makeApp();
    await writeFile(path.join(root, 'src/B.catalog.svelte'), '<Section title="B"><p>b</p></Section>');
    await writeFile(path.join(root, 'src/B.catalog.md'), '# B');
    const { p } = boot(root, { suffix: 'catalog' });
    const addWatchFile = vi.fn();
    expect(p.load.call({ addWatchFile }, meta('app/B'))).toContain('<h1>B</h1>');
    expect(addWatchFile).toHaveBeenCalledWith(`${root}/src/B.catalog.md`);
  });

  // a throw would be a transform error, which Vite shows in an overlay on every tab of the dev server, the app's too
  it('on the dev server, gives the error of a file that does not compile instead of failing', async () => {
    const { root } = await makeApp();
    await writeFile(path.join(root, 'src/Broken.zukan.svelte'), '<Section><p>x</p></Section>');
    const { p } = boot(root);
    const code = p.load.call({ addWatchFile: vi.fn() }, meta('app/Broken'));
    const data = JSON.parse(code.replace(/^export default |;\n$/g, ''));
    expect(data).toMatchObject({ sections: [], error: expect.stringMatching(/^src\/Broken\.zukan\.svelte:1 .*title/) });
  });

  it('fails the build on a file that does not compile', async () => {
    const { root } = await makeApp();
    await writeFile(path.join(root, 'src/Broken.zukan.svelte'), '<Section><p>x</p></Section>');
    const { p } = await bootBuild(root, { build: true });
    expect(() => p.load.call({ addWatchFile: vi.fn() }, meta('app/Broken'))).toThrow(/Broken\.zukan\.svelte:1/);
  });

  it('throws for an unknown ID', async () => {
    const { root } = await makeApp();
    const { p } = boot(root);
    expect(() => p.load.call({ addWatchFile: vi.fn() }, meta('app/Nope'))).toThrow(/no catalog file/);
  });

  it.each(['My Button', '100%', 'theme.css', 'ボタン'])('finds the file %s', async (name) => {
    const { root } = await makeApp();
    await writeFile(path.join(root, `src/${name}.zukan.svelte`), '<Section title="B"><p>b</p></Section>');
    const { p } = boot(root);
    expect(p.load.call({ addWatchFile: vi.fn() }, meta(`app/${name}`))).toContain('"title":"B"');
  });

  it('rejects an ID that is not hex', async () => {
    const { root } = await makeApp();
    const { p } = boot(root);
    expect(() => p.load.call({ addWatchFile: vi.fn() }, '\0' + META + 'zz')).toThrow(/no catalog file/);
  });

  it('finds a file created after the first load, without an HMR event', async () => {
    const { root } = await makeApp();
    const { p } = boot(root);
    p.load.call({ addWatchFile: vi.fn() }, meta('app/A'));
    await writeFile(path.join(root, 'src/C.zukan.svelte'), '<Section title="C"><p>c</p></Section>');
    expect(p.load.call({ addWatchFile: vi.fn() }, meta('app/C'))).toContain('"title":"C"');
  });

  it('does not serve a file deleted with an HMR event', async () => {
    const { root } = await makeApp();
    const { p } = boot(root);
    p.load.call({ addWatchFile: vi.fn() }, meta('app/A'));
    rmSync(path.join(root, 'src/A.zukan.svelte'));
    const ctx = {
      environment: {
        config: { consumer: 'client' },
        hot: { send: vi.fn() },
        moduleGraph: { getModuleById: vi.fn(), idToModuleMap: new Map(), invalidateModule: vi.fn() }
      }
    };
    p.hotUpdate.call(ctx, { type: 'delete', file: `${root}/src/A.zukan.svelte`, modules: [], timestamp: 1 });
    expect(() => p.load.call({ addWatchFile: vi.fn() }, meta('app/A'))).toThrow(/no catalog file/);
  });
});

type Res = {
  status?: string | number;
  body?: string;
  type?: string;
  location?: string;
  headers?: Record<string, unknown>;
};
const request = (mw: (...a: unknown[]) => void, url: string, method = 'GET') =>
  new Promise<Res>((resolve) => {
    const out: Res = {};
    const res = {
      statusCode: 200,
      setHeader: (k: string, v: string) => {
        if (k.toLowerCase() === 'content-type') out.type = v;
        else if (k.toLowerCase() === 'location') out.location = v;
        else out.headers = { ...out.headers, [k.toLowerCase()]: v };
      },
      end(body?: string | Buffer) {
        resolve({ ...out, ...(this.statusCode !== 200 && { status: this.statusCode }), body: body?.toString() });
      }
    };
    mw({ url, method }, res, () => resolve({ status: 'next' }));
  });

describe('configureServer', () => {
  it('serves the catalog as data at /__zukan/catalog.json', async () => {
    const { tmp, root } = await makeApp();
    await writeFile(path.join(root, 'src/A.zukan.md'), '# A\n\nAbout A.');
    await writeFile(
      path.join(root, 'src/A.svelte'),
      '<script lang="ts">\n  let { a = 1 }: { a?: number } = $props();\n</script>'
    );
    await writeFile(path.join(root, 'src/Broken.zukan.svelte'), '<Section><p>x</p></Section>');
    const { p } = boot(root, { title: 'My UI' });
    const server = fakeServer(root);
    p.configureServer(server);
    const res = await request(server.middlewares.use.mock.calls[0][0], '/__zukan/catalog.json');
    expect(res.type).toBe('application/json');
    expect(res.body).not.toContain(tmp);
    const data = JSON.parse(res.body!);
    expect(data.title).toBe('My UI');
    const a = data.components.find((c: { id: string }) => c.id === 'app/A');
    expect(a).toMatchObject({
      group: 'app',
      name: 'A',
      file: 'src/A.zukan.svelte',
      component: 'src/A.svelte',
      doc: '# A\n\nAbout A.',
      props: [{ name: 'a', type: 'number', default: '1' }],
      sections: [{ title: 'Foo', preview: '#/preview/app/A?section=Foo' }]
    });
    expect(a.sections[0].code).toBe('<div>x</div>');
    expect(data.uncataloged).toEqual([]);
    // a file that does not compile is listed with its error instead of failing the whole response
    const broken = data.components.find((c: { id: string }) => c.id === 'app/Broken');
    expect(broken).toMatchObject({
      sections: [],
      error: expect.stringMatching(/^src\/Broken\.zukan\.svelte:1 .*title/)
    });
  });

  it('lists components without a catalog file in catalog.json and in the catalog module', async () => {
    const { root } = await makeApp();
    await writeFile(path.join(root, 'src/Lone.svelte'), '<p>lone</p>');
    const { p } = boot(root);
    const server = fakeServer(root);
    p.configureServer(server);
    const res = await request(server.middlewares.use.mock.calls[0][0], '/__zukan/catalog.json');
    expect(JSON.parse(res.body!).uncataloged).toEqual([{ group: 'app', file: 'src/Lone.svelte' }]);
    expect(p.load('\0virtual:svelte-zukan/catalog')).toContain(
      'export const uncataloged = [{"group":"app","file":"src/Lone.svelte"}];'
    );
  });

  it('gives the dev catalog the files to open in an editor, and the build none', async () => {
    const { root } = await makeApp();
    await writeFile(path.join(root, 'src/A.svelte'), '<p>a</p>');
    const dev = boot(root).p.load('\0virtual:svelte-zukan/catalog');
    expect(dev).toContain(`"edit":{"file":"${root}/src/A.zukan.svelte","component":"${root}/src/A.svelte"}`);
    const { p } = await bootBuild(root, { build: true });
    const built = p.load('\0virtual:svelte-zukan/catalog');
    expect(built).not.toContain('"edit"');
  });

  // a throw would reach Vite's error middleware, which puts an overlay on every tab, the app's too, and the fix reloads
  // only the catalog
  it('on the dev server, gives a duplicate ID to the catalog page and catalog.json instead of failing', async () => {
    const { tmp, root } = await makeApp();
    mkdirSync(path.join(root, 'src/A'));
    await writeFile(path.join(root, 'src/A/A.zukan.svelte'), source);
    await writeFile(path.join(root, 'src/Lone.svelte'), '<p>lone</p>');
    const { p } = boot(root);
    const server = fakeServer(root);
    p.configureServer(server);
    const list: string = p.load('\0virtual:svelte-zukan/catalog');
    expect(list).toContain('export const catalog = [\n\n];');
    expect(list).toContain('export const uncataloged = [];');
    expect(list).toMatch(
      /^export const error = "svelte-zukan: duplicate catalog ID \\"app\/A\\":.*src\/A\.zukan\.svelte/m
    );
    expect(list).not.toContain(tmp);
    const meta = p.load.call({ addWatchFile: vi.fn() }, '\0' + metaId('app/A'));
    expect(meta).toContain('"error":"svelte-zukan: duplicate catalog ID');
    const res = await request(server.middlewares.use.mock.calls[0][0], '/__zukan/catalog.json');
    expect(res).toMatchObject({ status: 500, type: 'application/json' });
    expect(res.body).not.toContain(tmp);
    expect(JSON.parse(res.body!).error).toMatch(/^svelte-zukan: duplicate catalog ID "app\/A"/);

    rmSync(path.join(root, 'src/A'), { recursive: true });
    expect(p.load('\0virtual:svelte-zukan/catalog')).toContain('export const error = null;');
    const fixed = await request(server.middlewares.use.mock.calls[0][0], '/__zukan/catalog.json');
    expect(JSON.parse(fixed.body!).components).toHaveLength(1);
  });

  it('gives a duplicate ID outside the root by the path relative to it', async () => {
    const { tmp, root, outside } = await makeApp();
    mkdirSync(path.join(outside, 'B'));
    await writeFile(path.join(outside, 'B/B.zukan.svelte'), source);
    const { p } = boot(root, { groups: { app: 'src', ui: '../outside' } });
    const server = fakeServer(root);
    p.configureServer(server);
    const res = await request(server.middlewares.use.mock.calls[0][0], '/__zukan/catalog.json');
    expect(res).toMatchObject({ status: 500 });
    expect(res.body).not.toContain(tmp);
    expect(JSON.parse(res.body!).error).toContain('../outside/B.zukan.svelte');
    const list: string = p.load('\0virtual:svelte-zukan/catalog');
    expect(list).not.toContain(tmp);
  });

  it('fails the build on a duplicate ID', async () => {
    const { root } = await makeApp();
    mkdirSync(path.join(root, 'src/A'));
    await writeFile(path.join(root, 'src/A/A.zukan.svelte'), source);
    const { p } = await bootBuild(root, { build: true });
    expect(() => p.load('\0virtual:svelte-zukan/catalog')).toThrow(/duplicate catalog ID "app\/A"/);
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

  it('answers only GET and HEAD', async () => {
    const { root } = await makeApp();
    const server = fakeServer(root);
    boot(root).p.configureServer(server);
    const mw = server.middlewares.use.mock.calls[0][0];
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS'])
      for (const url of ['/__zukan', '/__zukan/', '/__zukan/catalog.json'])
        expect(await request(mw, url, method)).toEqual({ status: 'next' });
    expect((await request(mw, '/__zukan/', 'HEAD')).type).toMatch(/^text\/html/);
  });

  it('sends the configured server.headers', async () => {
    const { root } = await makeApp();
    const server = fakeServer(root, '/', { 'cross-origin-embedder-policy': 'require-corp', 'x-test': ['a', 'b'] });
    boot(root).p.configureServer(server);
    const res = await request(server.middlewares.use.mock.calls[0][0], '/__zukan/');
    expect(res.type).toMatch(/^text\/html/);
    expect(res.headers).toEqual({ 'cross-origin-embedder-policy': 'require-corp', 'x-test': ['a', 'b'] });
  });

  it('lets the catalog page frame itself, its previews, under the configured server.headers', async () => {
    const { root } = await makeApp();
    const csp = [
      "default-src 'self'; script-src 'none'; frame-ancestors https://a.example, frame-ancestors 'SELF' https://b.example",
      "Frame-Ancestors 'none'; img-src *",
      "default-src 'none'"
    ];
    const server = fakeServer(root, '/', { 'X-Frame-Options': 'DENY', 'content-security-policy': csp });
    boot(root).p.configureServer(server);
    const mw = server.middlewares.use.mock.calls[0][0];
    expect((await request(mw, '/__zukan/')).headers).toEqual({
      'x-frame-options': 'SAMEORIGIN',
      'content-security-policy': [
        "default-src 'self'; script-src 'none'; frame-ancestors https://a.example 'self', frame-ancestors 'SELF' https://b.example",
        "Frame-Ancestors 'self'; img-src *",
        "default-src 'none'"
      ]
    });
    // only the page is framed
    expect((await request(mw, '/__zukan/catalog.json')).headers).toMatchObject({ 'x-frame-options': 'DENY' });
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

  // SvelteKit's `paths.base: '/app'` resolves to the base '/app/', but Vite prints it without the slash
  it.each(['http://localhost:5173/app/', 'http://localhost:5173/app'])(
    'prints the catalog URL after the server URLs (%s)',
    async (url) => {
      const { root } = await makeApp();
      const server = fakeServer(root, '/app/');
      const original = server.printUrls;
      boot(root).p.configureServer(server);
      server.resolvedUrls = { local: [url], network: [] };
      server.printUrls();
      expect(original).toHaveBeenCalled();
      expect(server.config.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:5173/app/__zukan/')
      );
    }
  );
});

describe('configurePreviewServer', () => {
  const setup = async (
    base = '/',
    options: Parameters<typeof zukan>[0] = { build: true },
    headers?: Record<string, string>
  ) => {
    const { root } = await makeApp();
    mkdirSync(path.join(root, 'zukan-dist/_zukan'), { recursive: true });
    await writeFile(path.join(root, 'zukan-dist/index.html'), '<html>catalog</html>');
    await writeFile(path.join(root, 'zukan-dist/_zukan/zukan-abc.js'), 'export {}');
    const server = fakeServer(root, base, headers);
    boot(root, options).p.configurePreviewServer(server);
    return { root, server, mw: server.middlewares.use.mock.calls[0]?.[0] };
  };

  it('serves index.html and the files under _zukan/', async () => {
    const { mw } = await setup();
    const html = await request(mw, '/__zukan/');
    expect(html.body).toContain('catalog');
    expect(html.type).toMatch(/^text\/html/);
    expect((await request(mw, '/__zukan/_zukan/zukan-abc.js')).type).toMatch(/javascript/);
  });

  it.each([
    ['photo.jpeg', 'image/jpeg'],
    ['module.wasm', 'application/wasm'],
    ['font.woff', 'font/woff'],
    ['doc.pdf', 'application/pdf'],
    ['notes.txt', 'text/plain; charset=utf-8'],
    ['captions.vtt', 'text/vtt; charset=utf-8'],
    ['sound.mp3', 'audio/mpeg'],
    ['sound.ogg', 'audio/ogg'],
    ['sound.wav', 'audio/wav'],
    ['sound.flac', 'audio/flac'],
    ['sound.aac', 'audio/aac'],
    ['sound.opus', 'audio/ogg'],
    ['sound.m4a', 'audio/mp4'],
    ['clip.mov', 'video/quicktime'],
    ['app.webmanifest', 'application/manifest+json'],
    ['worker.mjs', 'text/javascript; charset=utf-8'],
    ['lib.cjs', 'text/javascript; charset=utf-8']
  ])('serves %s as %s', async (name, type) => {
    const { root, mw } = await setup();
    await writeFile(path.join(root, 'zukan-dist/_zukan', name), '');
    expect((await request(mw, `/__zukan/_zukan/${name}`)).type).toBe(type);
  });

  it('sends the configured preview.headers, letting the catalog page frame itself', async () => {
    const headers = { 'x-frame-options': 'DENY', 'content-security-policy': "frame-ancestors 'none'", 'x-test': 'a' };
    const { mw } = await setup('/', { build: true }, headers);
    expect((await request(mw, '/__zukan/')).headers).toEqual({
      'x-frame-options': 'SAMEORIGIN',
      'content-security-policy': "frame-ancestors 'self'",
      'x-test': 'a'
    });
    const js = await request(mw, '/__zukan/_zukan/zukan-abc.js');
    expect(js.type).toMatch(/javascript/);
    expect(js.headers).toEqual(headers);
  });

  it('redirects /__zukan to /__zukan/', async () => {
    const { mw } = await setup();
    expect(await request(mw, '/__zukan?a=1')).toMatchObject({ status: 302, location: '/__zukan/?a=1' });
  });

  it('leaves other URLs and missing files to the next middleware', async () => {
    const { mw } = await setup();
    for (const url of ['/', '/__zukanx', '/__zukan/nope.js'])
      expect(await request(mw, url)).toEqual({ status: 'next' });
  });

  it('does not serve files outside the catalog directory', async () => {
    const { mw } = await setup();
    for (const url of ['/__zukan/..%2Fpackage.json', '/__zukan/%2e%2e/package.json'])
      expect(await request(mw, url)).toEqual({ status: 'next' });
  });

  it('follows base', async () => {
    const { mw } = await setup('/app/');
    expect((await request(mw, '/app/__zukan/')).body).toContain('catalog');
    expect(await request(mw, '/__zukan/')).toEqual({ status: 'next' });
  });

  it('does nothing without build', async () => {
    const { server } = await setup('/', {});
    expect(server.middlewares.use).not.toHaveBeenCalled();
  });
});

describe('hotUpdate of the catalog list', () => {
  const catalogOnly = { id: '\0virtual:svelte-zukan/catalog' };
  const setup = async (consumer: 'client' | 'server' = 'client') => {
    const { root, outside } = await makeApp();
    const { p } = boot(root);
    const catalogMod = { id: '\0virtual:svelte-zukan/catalog' };
    const metaMod = { id: '\0virtual:svelte-zukan/meta/app%2FA' };
    const ctx = {
      environment: {
        config: { consumer },
        hot: { send: vi.fn() },
        moduleGraph: {
          getModuleById: vi.fn((id: string) => (id === catalogMod.id ? catalogMod : undefined)),
          idToModuleMap: new Map([[metaMod.id, metaMod]]),
          invalidateModule: vi.fn()
        }
      }
    };
    const run = (type: string, file: string, modules: unknown[] = []) =>
      p.hotUpdate.call(ctx, { type, file, modules, timestamp: 1 });
    return { root, outside, ctx, run, catalogMod, metaMod };
  };

  it.each(['create', 'delete'])('invalidates the list on %s inside a scanned dir', async (type) => {
    const { root, ctx, run, catalogMod, metaMod } = await setup();
    expect(run(type, `${root}/src/lib/New.zukan.svelte`)).toEqual([]);
    const invalidated = ctx.environment.moduleGraph.invalidateModule.mock.calls.map((c: unknown[]) => c[0]);
    expect(invalidated).toEqual(expect.arrayContaining([catalogMod, metaMod]));
    expect(ctx.environment.hot.send).toHaveBeenCalledWith({ type: 'custom', event: 'zukan:reload' });
    expect(ctx.environment.hot.send).not.toHaveBeenCalledWith({ type: 'full-reload' });
  });

  it.each(['create', 'delete'])('also invalidates the file itself on %s', async (type) => {
    const { root, ctx, run, catalogMod, metaMod } = await setup();
    const own = { id: `${root}/src/lib/New.zukan.svelte`, importers: new Set([catalogOnly]) };
    expect(run(type, `${root}/src/lib/New.zukan.svelte`, [own])).toEqual([]);
    const invalidated = ctx.environment.moduleGraph.invalidateModule.mock.calls.map((c: unknown[]) => c[0]);
    expect(invalidated).toEqual(expect.arrayContaining([own, catalogMod, metaMod]));
  });

  it('reloads on catalog file update', async () => {
    const { root, ctx, run, metaMod } = await setup();
    const mod = { id: `${root}/src/A.zukan.svelte`, importers: new Set([catalogOnly]) };
    expect(run('update', `${root}/src/A.zukan.svelte`, [mod])).toEqual([]);
    const invalidated = ctx.environment.moduleGraph.invalidateModule.mock.calls.map((c: unknown[]) => c[0]);
    expect(invalidated).toEqual(expect.arrayContaining([mod, metaMod]));
    expect(ctx.environment.hot.send).toHaveBeenCalledWith({ type: 'custom', event: 'zukan:reload' });
  });

  it('ignores an update of a catalog file outside the scanned dirs', async () => {
    const { root, outside, ctx, run } = await setup();
    for (const file of [`${outside}/B.zukan.svelte`, `${root}/Other.zukan.svelte`])
      expect(run('update', file, [{ id: file, importers: new Set() }])).toBeUndefined();
    expect(ctx.environment.moduleGraph.invalidateModule).not.toHaveBeenCalled();
    expect(ctx.environment.hot.send).not.toHaveBeenCalled();
  });

  // the catalog's own import chain ends at the entry, which accepts no update: Vite would answer with `full-reload`
  it('leaves to Vite only the modules that the app imports', async () => {
    const { root, run } = await setup();
    const file = `${root}/src/A.zukan.svelte`;
    const shared = { id: file, importers: new Set([catalogOnly, { id: `${root}/src/routes/+page.svelte` }]) };
    const css = { id: `${file}?svelte&type=style&lang.css`, importers: new Set([shared]) };
    expect(run('update', file, [shared, css])).toEqual([shared, css]);
    expect(run('update', file, [{ id: file, importers: new Set([catalogOnly]) }])).toEqual([]);
  });

  it('an edit of the logo reloads only the catalog', async () => {
    const { root } = await makeApp();
    const { p } = boot(root, { logo: 'logo.png' });
    const ctx = {
      environment: {
        config: { consumer: 'client' },
        hot: { send: vi.fn() },
        moduleGraph: { getModuleById: vi.fn(), idToModuleMap: new Map(), invalidateModule: vi.fn() }
      }
    };
    const url = { id: `${root}/logo.png?url`, importers: new Set([{ id: '\0' + ENTRY }]) };
    const own = { id: `${root}/logo.png`, importers: new Set([{ id: `${root}/src/main.ts` }]) };
    const result = p.hotUpdate.call(ctx, {
      type: 'update',
      file: `${root}/logo.png`,
      modules: [url, own],
      timestamp: 1
    });
    expect(result).toEqual([own]);
    expect(ctx.environment.moduleGraph.invalidateModule.mock.calls.map((c: unknown[]) => c[0])).toContain(url);
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

  it('watches a groups dir reached through a node_modules link by its real path', async () => {
    const { tmp, root } = await makeApp();
    const real = `${tmp}/ui/src`;
    mkdirSync(real, { recursive: true });
    await writeFile(`${real}/B.zukan.svelte`, source);
    mkdirSync(`${root}/node_modules/@acme`, { recursive: true });
    symlinkSync(`${tmp}/ui`, `${root}/node_modules/@acme/ui`, 'junction');
    const { p, config } = boot(root, { groups: { ui: 'node_modules/@acme/ui/src' } });
    expect(config.server?.fs?.allow).toEqual([searchForWorkspaceRoot(root), libDir]);
    const server = fakeServer(root);
    p.configureServer(server);
    // Vite's watcher ignores node_modules
    expect(server.watcher.add).toHaveBeenCalledWith([real]);
    const res = await request(server.middlewares.use.mock.calls[0][0], '/__zukan/catalog.json');
    expect(JSON.parse(res.body!).components).toMatchObject([
      { id: 'ui/B', file: 'node_modules/@acme/ui/src/B.zukan.svelte' }
    ]);

    const catalogMod = { id: '\0virtual:svelte-zukan/catalog' };
    const ctx = {
      environment: {
        config: { consumer: 'client' },
        hot: { send: vi.fn() },
        moduleGraph: {
          getModuleById: vi.fn((id: string) => (id === catalogMod.id ? catalogMod : undefined)),
          idToModuleMap: new Map(),
          invalidateModule: vi.fn()
        }
      }
    };
    const run = (type: string, file: string) => p.hotUpdate.call(ctx, { type, file, modules: [], timestamp: 1 });
    expect(run('create', `${real}/New.zukan.svelte`)).toEqual([]);
    expect(run('create', `${real}/New.svelte`)).toBeUndefined();
    const invalidated = ctx.environment.moduleGraph.invalidateModule.mock.calls.map((c: unknown[]) => c[0]);
    expect(invalidated).toEqual([catalogMod, catalogMod]);
    expect(ctx.environment.hot.send).toHaveBeenCalledTimes(2);
  });

  it('tells the components of a linked groups dir by the configured dir', async () => {
    const { tmp, root } = await makeApp();
    // the configured dir does not end in /src, so its routes/ holds components; the real one does
    mkdirSync(`${tmp}/ui/src/routes`, { recursive: true });
    mkdirSync(`${root}/node_modules`, { recursive: true });
    symlinkSync(`${tmp}/ui/src`, `${root}/node_modules/ui`, 'junction');
    const { p } = boot(root, { groups: { ui: 'node_modules/ui' } });
    p.configureServer(fakeServer(root));
    const list = { id: '\0virtual:svelte-zukan/catalog' };
    const ctx = {
      environment: {
        config: { consumer: 'client' },
        hot: { send: vi.fn() },
        moduleGraph: { getModuleById: () => list, idToModuleMap: new Map(), invalidateModule: vi.fn() }
      }
    };
    p.hotUpdate.call(ctx, { type: 'create', file: `${tmp}/ui/src/routes/Foo.svelte`, modules: [], timestamp: 1 });
    expect(ctx.environment.hot.send).toHaveBeenCalledWith({ type: 'custom', event: 'zukan:reload' });
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
    // an environment's own outDir replaces the top-level one
    await reject('site', { environments: { client: { build: { outDir: 'site' } } } });
    await reject('site/zukan', { environments: { ssr: { build: { outDir: `${root}/site` } } } });
    expect(
      (await bootBuild(root, { build: { outDir: 'out' } }, { environments: { client: { build: { outDir: 'site' } } } }))
        .added
    ).toBeDefined();
    expect((await bootBuild(root, { build: { outDir: 'out' } }, { build: { outDir: 'output' } })).added).toBeDefined();
  });

  it("rejects a catalog outDir inside the app's publicDir", async () => {
    const { root } = await makeApp();
    const reject = (outDir: string, user: object = {}) =>
      expect(bootBuild(root, { build: { outDir } }, user)).rejects.toThrow(
        `svelte-zukan: build.outDir of the catalog (${root}/${outDir}) must not be inside the app's publicDir`
      );
    // Vite's default is public; SvelteKit sets it to kit.files.assets
    await reject('public/zukan');
    await reject('static/zukan', { publicDir: 'static' });
    await reject('static', { publicDir: `${root}/static` });
    expect((await bootBuild(root, { build: { outDir: 'public/zukan' } }, { publicDir: false })).added).toBeDefined();
    expect((await bootBuild(root, { build: { outDir: 'public-zukan' } })).added).toBeDefined();
  });

  // the shape of the real plugin: Kit 3 keeps `kit.outDir` at `api.options.outDir`
  const kitPlugins = (options: object = {}) => [
    Promise.resolve([{ name: 'vite-plugin-sveltekit-setup', api: { options } }])
  ];

  it("rejects a catalog outDir that overlaps SvelteKit's kit.outDir", async () => {
    const { root } = await makeApp();
    const reject = (outDir: string, kit?: object) =>
      expect(bootBuild(root, { build: { outDir } }, { plugins: kitPlugins(kit) })).rejects.toThrow(
        /svelte-zukan: build\.outDir of the catalog .* must not overlap SvelteKit's kit\.outDir/
      );
    // the default is .svelte-kit
    await reject('.svelte-kit');
    await reject('.svelte-kit/zukan');
    // Kit resolves its outDir to an absolute path
    await reject('gen', { outDir: `${root}/gen` });
    await reject('gen/zukan', { outDir: `${root}/gen` });
    await reject('gen', { outDir: `${root}/gen/kit` });
    const ok = await bootBuild(root, { build: { outDir: '.svelte-kit' } }, { plugins: kitPlugins({ outDir: 'gen' }) });
    expect(ok.added).toBeDefined();
    const real = (outDir: string) =>
      bootBuild(root, { build: { outDir } }, { plugins: [sveltekit({ outDir: 'gen' })] });
    await expect(real('gen/zukan')).rejects.toThrow(/must not overlap SvelteKit's kit\.outDir/);
    expect((await real('.svelte-kit')).added).toBeDefined();
    // without Kit, .svelte-kit is just a directory
    expect((await bootBuild(root, { build: { outDir: '.svelte-kit/zukan' } })).added).toBeDefined();
  });

  type Env = { isBuilt: boolean; config?: { build: { outDir: string; write?: boolean } } };

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
            chunkFileNames: expect.any(Function),
            assetFileNames: '_zukan/[name]-[hash][extname]'
          }
        }
      }
    });
    expect((await bootBuild(root, { build: true })).added.environments.zukan.build.outDir).toBe(`${root}/zukan-dist`);
  });

  it('names a metadata chunk without its ID, which can be longer than a file name may be', async () => {
    const { root } = await makeApp();
    const { added } = await bootBuild(root, { build: true });
    const { chunkFileNames } = added.environments.zukan.build.rolldownOptions.output;
    expect(chunkFileNames({ facadeModuleId: '\0' + metaId('ui/' + 'ボタン'.repeat(50)) })).toBe(
      '_zukan/meta-[hash].js'
    );
    expect(chunkFileNames({ facadeModuleId: `${root}/src/Foo.zukan.svelte` })).toBe('_zukan/[name]-[hash].js');
    expect(chunkFileNames({ facadeModuleId: null })).toBe('_zukan/[name]-[hash].js');
  });

  it('defines the SvelteKit globals only with SvelteKit', async () => {
    const { root } = await makeApp();
    const kit = [Promise.resolve([{ name: 'vite-plugin-sveltekit-setup' }])];
    const { added } = await bootBuild(root, { build: true }, { plugins: kit });
    expect(added.environments.zukan.define).toEqual({
      __SVELTEKIT_PAYLOAD__: '({ env: {} })',
      __SVELTEKIT_HAS_SERVER_LOAD__: 'false',
      __SVELTEKIT_HAS_UNIVERSAL_LOAD__: 'false',
      __SVELTEKIT_MANIFEST_ASSETS__: '[]',
      __SVELTEKIT_MANIFEST_IMMUTABLE__: '[]',
      __SVELTEKIT_MANIFEST_PRERENDERED__: '[]',
      __SVELTEKIT_MANIFEST_ROUTES__: '[]'
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
        cssCodeSplit: false,
        cssTarget: 'chrome107',
        // library mode: the app's bundle leaves svelte to its users, the catalog has none
        rolldownOptions: {
          input: { main: 'index.html', nested: 'nested/index.html', zukan: ENTRY },
          external: ['svelte', /^svelte\//]
        }
      }
    });
    const env = inherited();
    p.configEnvironment('zukan', env);
    expect(env.build).toEqual({
      ssr: false,
      lib: false,
      emptyOutDir: false,
      cssCodeSplit: true,
      cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5'],
      chunkSizeWarningLimit: 1000,
      rolldownOptions: { input: { zukan: ENTRY } }
    });
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
    // a worker named for the app, which generateBundle moves under _zukan/
    const worker = { ...ctx, hostId: '_zukan/App-1.js' };
    expect(render('_app/immutable/workers/w-1.js', worker)).toEqual({
      runtime: 'new URL("./_app/immutable/workers/w-1.js", import.meta.url).href'
    });
    expect(render('assets/w-1.js', worker)).toEqual({ runtime: 'new URL("./assets/w-1.js", import.meta.url).href' });
    expect(own).toHaveBeenCalledTimes(1);
    // without one, the app's files get Vite's default
    const plain = await bootBuild(root, { build: true });
    expect(plain.config.experimental.renderBuiltUrl('assets/index-1.js', ctx)).toBeUndefined();
  });

  const fakeBuilder = (fileName: string, others: Record<string, Env>, { array = false, watch = false } = {}) => {
    const zukanEnv: Env = { isBuilt: false, config: { build: { outDir: 'zukan-dist' } } };
    for (const e of Object.values(others)) e.config ??= { build: { outDir: 'dist' } };
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
    mkdirSync(outDir);
    const { p } = await bootBuild(root, { build: true, title: 'My UI', locale: 'ja' }, { plugins: kitPlugins() });
    const { builder, zukanEnv } = fakeBuilder('_zukan/zukan-abc.js', { client: { isBuilt: true } }, { array });
    await p.buildApp.handler(builder);
    expect(builder.build).toHaveBeenCalledTimes(1);
    expect(builder.build).toHaveBeenCalledWith(zukanEnv);
    const html = readFileSync(`${outDir}/index.html`, 'utf-8');
    expect(html).toContain('<script type="module" src="./_zukan/zukan-abc.js"></script>');
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain('<title>My UI</title>');
  });

  const generate = async (env: string, kit?: object) => {
    const { root } = await makeApp();
    const { p } = await bootBuild(root, { build: true }, kit && { plugins: kitPlugins(kit) });
    const bundle: Record<string, object> = {
      '_zukan/zukan-1.js': { type: 'chunk' },
      '_zukan/a-1.png': { type: 'asset', source: 'png' },
      'kit-app/immutable/workers/w-1.js': { type: 'asset', source: 'fetch(`/app/kit-app/immutable/workers/m-1.txt`)' },
      'kit-app/immutable/workers/m-1.txt': { type: 'asset', source: 'm' },
      'kit-app/version.json': { type: 'asset', source: '{}' }
    };
    const emitFile = vi.fn();
    await p.generateBundle.handler.call(
      { environment: { name: env, config: { base: '/app/' } }, emitFile },
      {},
      bundle
    );
    return { bundle, emitFile };
  };

  it("moves the catalog's files named for the app under _zukan/, and drops SvelteKit's version.json", async () => {
    expect(plugin.generateBundle.order).toBe('post');
    const { bundle, emitFile } = await generate('zukan', { appDir: 'kit-app' });
    expect(Object.keys(bundle)).toEqual(['_zukan/zukan-1.js', '_zukan/a-1.png']);
    // the worker loads the asset next to it, which moves with it, instead of from the app's base
    expect(emitFile.mock.calls).toEqual([
      [{ type: 'asset', fileName: '_zukan/kit-app/immutable/workers/w-1.js', source: 'fetch(`./m-1.txt`)' }],
      [{ type: 'asset', fileName: '_zukan/kit-app/immutable/workers/m-1.txt', source: 'm' }]
    ]);
    // without SvelteKit, a version.json is just a file
    expect((await generate('zukan')).emitFile).toHaveBeenCalledTimes(3);
    // the app's own environments are left alone
    const app = await generate('client', { appDir: 'kit-app' });
    expect(Object.keys(app.bundle)).toHaveLength(5);
    expect(app.emitFile).not.toHaveBeenCalled();
  });

  // `worker.rolldownOptions.output.entryFileNames` can name a worker so
  it.each(['mjs', 'cjs'])('points a .%s worker at the assets moved with it', async (ext) => {
    const { root } = await makeApp();
    const { p } = await bootBuild(root, { build: true });
    const bundle = {
      [`w-1.${ext}`]: { type: 'asset', source: 'fetch(`/app/assets/m-1.txt`)' },
      'assets/m-1.txt': { type: 'asset', source: 'm' }
    };
    const emitFile = vi.fn();
    await p.generateBundle.handler.call(
      { environment: { name: 'zukan', config: { base: '/app/' } }, emitFile },
      {},
      bundle
    );
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: `_zukan/w-1.${ext}`,
      source: 'fetch(`./assets/m-1.txt`)'
    });
  });

  it('leaves _app/version.json alone without SvelteKit', async () => {
    const { root } = await makeApp();
    const outDir = `${root}/zukan-dist`;
    mkdirSync(`${outDir}/_app`, { recursive: true });
    await writeFile(`${outDir}/_app/version.json`, '{}');
    const { p } = await bootBuild(root, { build: true });
    const { builder } = fakeBuilder('_zukan/zukan-abc.js', { client: { isBuilt: true } });
    await p.buildApp.handler(builder);
    expect(existsSync(`${outDir}/_app/version.json`)).toBe(true);
  });

  it('rejects an environment outDir set after the config hook before building anything', async () => {
    const { root } = await makeApp();
    const { p } = await bootBuild(root, { build: true });
    // as a later `configEnvironment` hook would leave it
    const client = { isBuilt: false, config: { build: { outDir: 'zukan-dist/app' } } };
    const { builder } = fakeBuilder('_zukan/zukan-abc.js', { client });
    await expect(p.buildApp.handler(builder)).rejects.toThrow(
      `svelte-zukan: build.outDir of the catalog (${root}/zukan-dist) must not overlap the build.outDir of the client environment (${root}/zukan-dist/app)`
    );
    expect(builder.build).not.toHaveBeenCalled();
  });

  it('removes only the files of the previous catalog', async () => {
    const { root } = await makeApp();
    const outDir = `${root}/zukan-dist`;
    mkdirSync(`${outDir}/_zukan`, { recursive: true });
    await writeFile(`${outDir}/_zukan/old.js`, '');
    await writeFile(`${outDir}/index.html`, 'old');
    await writeFile(`${outDir}/keep.txt`, '');
    const { p } = await bootBuild(root, { build: true });
    const { builder } = fakeBuilder('_zukan/zukan-abc.js', { client: { isBuilt: true } });
    await p.buildApp.handler(builder);
    expect(existsSync(`${outDir}/_zukan/old.js`)).toBe(false);
    expect(existsSync(`${outDir}/keep.txt`)).toBe(true);
    expect(readFileSync(`${outDir}/index.html`, 'utf-8')).toContain('./_zukan/zukan-abc.js');
  });

  it('builds the catalog but writes and removes nothing with build.write: false', async () => {
    const { root } = await makeApp();
    const { p } = await bootBuild(root, { build: true });
    const { builder, zukanEnv } = fakeBuilder('_zukan/zukan-abc.js', { client: { isBuilt: true } });
    zukanEnv.config!.build.write = false;
    await p.buildApp.handler(builder);
    expect(builder.build).toHaveBeenCalledWith(zukanEnv);
    expect(existsSync(`${root}/zukan-dist`)).toBe(false);
  });

  it('leaves the previous catalog unchanged with build.write: false', async () => {
    const { root } = await makeApp();
    const outDir = `${root}/zukan-dist`;
    mkdirSync(`${outDir}/_zukan`, { recursive: true });
    await writeFile(`${outDir}/_zukan/old.js`, 'old js');
    await writeFile(`${outDir}/index.html`, 'old');
    const { p } = await bootBuild(root, { build: true });
    const { builder, zukanEnv } = fakeBuilder('_zukan/zukan-abc.js', { client: { isBuilt: true } });
    zukanEnv.config!.build.write = false;
    await p.buildApp.handler(builder);
    expect(readFileSync(`${outDir}/_zukan/old.js`, 'utf-8')).toBe('old js');
    expect(readFileSync(`${outDir}/index.html`, 'utf-8')).toBe('old');
    expect(existsSync(`${outDir}/catalog.json`)).toBe(false);
  });

  it('fails on a reserved group name before removing the previous catalog', async () => {
    const { tmp, root } = await makeApp();
    await writeFile(`${root}/package.json`, JSON.stringify({ name: 'app', dependencies: { preview: 'workspace:*' } }));
    mkdirSync(`${tmp}/preview/src`, { recursive: true });
    await writeFile(`${tmp}/preview/package.json`, JSON.stringify({ name: 'preview' }));
    await writeFile(`${tmp}/preview/src/P.zukan.svelte`, source);
    mkdirSync(`${root}/node_modules`);
    symlinkSync(`${tmp}/preview`, `${root}/node_modules/preview`, 'junction');
    const outDir = `${root}/zukan-dist`;
    mkdirSync(outDir);
    await writeFile(`${outDir}/index.html`, 'old');
    const { p } = await bootBuild(root, { build: true });
    const { builder, zukanEnv } = fakeBuilder('_zukan/zukan-abc.js', { client: { isBuilt: true } });
    await expect(p.buildApp.handler(builder)).rejects.toThrow(/group name "preview" is reserved/);
    expect(builder.build).not.toHaveBeenCalledWith(zukanEnv);
    expect(readFileSync(`${outDir}/index.html`, 'utf-8')).toBe('old');
  });

  it.each([
    ['build', true],
    ['build/zukan', true],
    ['zukan-dist', false],
    ['built', false]
  ])('with SvelteKit, warns once about a catalog outDir %s overlapping build/: %s', async (outDir, warns) => {
    const { root } = await makeApp();
    mkdirSync(`${root}/${outDir}`, { recursive: true });
    const { p } = await bootBuild(root, { build: { outDir } }, { plugins: kitPlugins() });
    const { builder } = fakeBuilder('_zukan/zukan-abc.js', { client: { isBuilt: true } });
    await p.buildApp.handler(builder);
    const warned = builder.config.logger.warn.mock.calls.map(([m]) => m);
    expect(warned).toEqual(
      warns
        ? [
            `svelte-zukan: build.outDir of the catalog (${root}/${outDir}) overlaps ${root}/build, which SvelteKit adapters usually empty after the catalog is written; set another one with \`build: { outDir }\``
          ]
        : []
    );
  });

  it('does not warn about build/ without SvelteKit', async () => {
    const { root } = await makeApp();
    mkdirSync(`${root}/build`);
    const { p } = await bootBuild(root, { build: { outDir: 'build' } });
    const { builder } = fakeBuilder('_zukan/zukan-abc.js', { client: { isBuilt: true } });
    await p.buildApp.handler(builder);
    expect(builder.config.logger.warn).not.toHaveBeenCalled();
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

describe('Tailwind CSS', () => {
  // the dev server's environments are never read without an entry, so the fake server has none
  it('does not load Tailwind until the list module is loaded', async () => {
    const { root } = await makeApp();
    await writeFile(path.join(root, 'src/app.css'), '@import "tailwindcss";');
    vi.mocked(loadTailwind).mockClear();
    const { p } = boot(root);
    p.configureServer(fakeServer(root));
    p.load('\0virtual:svelte-zukan/entry');
    p.load('\0virtual:svelte-zukan/catalog');
    expect(loadTailwind).not.toHaveBeenCalled();
  });

  it('leaves the Tailwind import out of the entry module without an entry', async () => {
    const { root } = await makeApp();
    const entry = boot(root).p.load('\0virtual:svelte-zukan/entry');
    expect(entry).not.toContain('virtual:svelte-zukan/tailwind');
    expect(entry).toContain('tailwind: []');
  });

  it('serves catalog.json with tailwind null without Tailwind', async () => {
    const { root } = await makeApp();
    const { p } = boot(root);
    const server = fakeServer(root);
    p.configureServer(server);
    const res = await request(server.middlewares.use.mock.calls[0][0], '/__zukan/catalog.json');
    expect(JSON.parse(res.body!).tailwind).toBeNull();
  });

  it('keeps a failed generation out of hotUpdate and out of the cache', async () => {
    const { root } = await makeApp();
    const { p } = boot(root);
    const server = fakeServer(root);
    p.configureServer(server);
    const list = { id: '\0virtual:svelte-zukan/tailwind' };
    const ctx = {
      environment: {
        config: { consumer: 'client' },
        logger: { warn: vi.fn() },
        hot: { send: vi.fn() },
        moduleGraph: {
          getModuleById: vi.fn((id: string) => (id === list.id ? list : undefined)),
          idToModuleMap: new Map([[list.id, list]]),
          invalidateModule: vi.fn()
        }
      }
    };
    vi.mocked(loadTailwind).mockClear();
    vi.mocked(loadTailwind).mockRejectedValueOnce(new Error('boom'));
    const result = p.hotUpdate.call(ctx, { type: 'create', file: `${root}/src/new.css`, modules: [], timestamp: 1 });
    expect(result).toBeUndefined();
    await vi.waitFor(() =>
      expect(ctx.environment.logger.warn).toHaveBeenCalledWith(expect.stringMatching(/^svelte-zukan: .*boom/))
    );
    expect(ctx.environment.hot.send).not.toHaveBeenCalled();
    const res = await request(server.middlewares.use.mock.calls[0][0], '/__zukan/catalog.json');
    expect(JSON.parse(res.body!).tailwind).toBeNull();
    expect(loadTailwind).toHaveBeenCalledTimes(2);
  });

  it('writes catalog.json with tailwind null without Tailwind', async () => {
    const { root } = await makeApp();
    mkdirSync(`${root}/zukan-dist`);
    const { p } = await bootBuild(root, { build: true });
    const builder = {
      config: { build: { watch: null }, logger: { warn: vi.fn() } },
      environments: {
        client: { isBuilt: true, config: { build: { outDir: 'dist' } } },
        zukan: { isBuilt: false, config: { build: {} } }
      },
      build: vi.fn(async () => ({ output: [{ type: 'chunk', name: 'zukan', fileName: '_zukan/zukan-1.js' }] }))
    };
    await p.buildApp.handler(builder);
    expect(JSON.parse(readFileSync(`${root}/zukan-dist/catalog.json`, 'utf-8')).tailwind).toBeNull();
    expect(builder.config.logger.warn).not.toHaveBeenCalled();
  });

  it('warns once per failing entry in the build and writes its error to catalog.json', async () => {
    const { tmp, root } = await makeApp();
    for (const name of ['tailwindcss', '@tailwindcss/node']) {
      const at = path.join(root, 'node_modules', name);
      mkdirSync(path.dirname(at), { recursive: true });
      symlinkSync(findPackage(name, import.meta.dirname)!, at, 'junction');
    }
    await writeFile(path.join(root, 'src/app.css'), '@import "tailwindcss";\n@theme { --color-brand: red; }');
    await writeFile(path.join(root, 'src/broken.css'), '@import "tailwindcss";\n@import "./missing.css";');
    const { p } = await bootBuild(root, { build: true });
    mkdirSync(`${root}/zukan-dist`);
    const config = await resolveConfig(
      { root, configFile: false, logLevel: 'silent', environments: { zukan: {} } },
      'build'
    );
    const zukanEnv = new BuildEnvironment('zukan', config);
    const builder = {
      config: { build: { watch: null }, logger: { warn: vi.fn() } },
      environments: { client: { isBuilt: true, config: { build: { outDir: 'dist' } } }, zukan: zukanEnv },
      build: vi.fn(async () => ({ output: [{ type: 'chunk', name: 'zukan', fileName: '_zukan/zukan-1.js' }] }))
    };
    await p.buildApp.handler(builder);
    const warned = builder.config.logger.warn.mock.calls.map(([m]) => m);
    expect(warned).toEqual([
      expect.stringMatching(/^svelte-zukan: Tailwind CSS entry src\/broken\.css: .*missing\.css/)
    ]);
    const json = readFileSync(`${root}/zukan-dist/catalog.json`, 'utf-8');
    expect(json).not.toContain(tmp);
    const { tailwind } = JSON.parse(json);
    expect(tailwind.map((t: { file: string }) => t.file)).toEqual(['src/app.css', 'src/broken.css']);
    expect(tailwind[0].variables['--color-brand']).toBe('red');
    expect(tailwind[1].error).toMatch(/missing\.css/);
  });
});

describe('public API', () => {
  it('exports only zukan', () => {
    expect(Object.keys(api)).toEqual(['zukan']);
  });

  it('is a pre plugin without a transform hook', () => {
    expect(plugin.name).toBe('vite-plugin-svelte-zukan');
    expect(plugin.enforce).toBe('pre');
    expect(plugin.transform).toBeUndefined();
  });
});

it("the svelte peer range starts no lower than Vite's Svelte plugin needs", () => {
  const floor = (dir: string) => {
    const range: string = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).peerDependencies.svelte;
    const [major, minor, patch] = range
      .match(/^\^(\d+)\.(\d+)\.(\d+)$/)!
      .slice(1)
      .map(Number);
    return major * 1e6 + minor * 1e3 + patch;
  };
  const sveltePlugin = findPackage('@sveltejs/vite-plugin-svelte', import.meta.dirname)!;
  expect(floor(fileURLToPath(new URL('../../..', import.meta.url)))).toBeGreaterThanOrEqual(floor(sveltePlugin));
});
