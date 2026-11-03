import { once } from 'node:events';
import { existsSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { createServer, normalizePath, type InlineConfig, type Plugin, type ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zukan } from './index.js';
import { findPackage } from './tailwind-load.js';
import { ENTRY, TAILWIND, TAILWIND_SOURCE, metaId } from './virtual.js';

let tmp: string;
let server: ViteDevServer;
let plugin: Plugin;
let send: ReturnType<typeof vi.spyOn>;

async function start(options: Parameters<typeof zukan>[0] = {}, config: InlineConfig = {}) {
  plugin = zukan(options);
  server = await createServer({
    ...config,
    root: join(tmp, 'app'),
    configFile: false,
    logLevel: 'silent',
    plugins: [plugin, ...(config.plugins ?? [])],
    // no HTTP or WebSocket server: payloads are read from the spy on hot.send
    server: { middlewareMode: true, ws: false }
  });
  // the race bounds the wait in case `ready` already fired
  await Promise.race([once(server.watcher, 'ready'), new Promise((r) => setTimeout(r, 3000))]);
  // files written just before the watcher started can still arrive as late `change` events
  const settle = () =>
    new Promise<void>((resolve) => {
      const done = () => {
        server.watcher.off('all', reset);
        resolve();
      };
      let timer = setTimeout(done, 500);
      const reset = () => {
        clearTimeout(timer);
        timer = setTimeout(done, 500);
      };
      server.watcher.on('all', reset);
    });
  await settle();
  send = vi.spyOn(server.environments.client.hot, 'send');
}

beforeEach(async () => {
  // native realpath: on macOS the tmpdir is a symlink and the watcher reports resolved paths, and on Windows it
  // can be an 8.3 short name (RUNNER~1) that Vite fails to load the Tailwind CSS entry from
  tmp = realpathSync.native(await mkdtemp(join(tmpdir(), 'zukan-hmr-')));
  await mkdir(join(tmp, 'app/src'), { recursive: true });
  writeFileSync(join(tmp, 'pnpm-workspace.yaml'), '');
  writeFileSync(join(tmp, 'app/package.json'), JSON.stringify({ name: 'app' }));
  writeFileSync(join(tmp, 'app/src/A.zukan.svelte'), '<Section title="A"><p>a</p></Section>');
  await start();
});

afterEach(async () => {
  await server.close();
  rmSync(tmp, { recursive: true, force: true });
});

const list = async () => (await server.environments.client.transformRequest('virtual:svelte-zukan/catalog'))!.code;
const meta = async (id: string) => (await server.environments.client.transformRequest(metaId(id)))!.code;
const reloaded = () => send.mock.calls.some(([p]: unknown[]) => (p as { event?: string })?.event === 'zukan:reload');
const fullReloads = () =>
  send.mock.calls.filter(([p]: unknown[]) => (p as { type?: string })?.type === 'full-reload').length;
const waitForReload = () => expect.poll(reloaded, { timeout: 10_000 }).toBe(true);

it('lists the catalog files', { timeout: 15_000 }, async () => {
  expect(await list()).toContain('A.zukan.svelte');
});

it('a new catalog file is listed after zukan:reload', { timeout: 15_000 }, async () => {
  await list();
  send.mockClear();
  writeFileSync(join(tmp, 'app/src/B.zukan.svelte'), '<Section title="B"><p>b</p></Section>');
  await waitForReload();
  expect(fullReloads()).toBe(0);
  expect(await list()).toContain('B.zukan.svelte');
});

it('editing a catalog file sends zukan:reload', { timeout: 15_000 }, async () => {
  await list();
  // without a Svelte plugin the file does not parse as JS; only its module graph entry matters
  await server.environments.client.transformRequest(join(tmp, 'app/src/A.zukan.svelte')).catch(() => {});
  send.mockClear();
  writeFileSync(join(tmp, 'app/src/A.zukan.svelte'), '<Section title="A"><p>changed</p></Section>');
  await waitForReload();
  expect(fullReloads()).toBe(0);
});

it('a deleted catalog file leaves the list', { timeout: 15_000 }, async () => {
  await list();
  send.mockClear();
  rmSync(join(tmp, 'app/src/A.zukan.svelte'));
  await waitForReload();
  expect(fullReloads()).toBe(0);
  expect(await list()).not.toContain('A.zukan.svelte');
});

it('a new .md file sends zukan:reload', { timeout: 15_000 }, async () => {
  send.mockClear();
  writeFileSync(join(tmp, 'app/src/A.zukan.md'), '# A');
  await waitForReload();
  expect(fullReloads()).toBe(0);
});

it('files outside the scanned dirs are ignored', { timeout: 15_000 }, async () => {
  send.mockClear();
  writeFileSync(join(tmp, 'app/other.zukan.svelte'), '<Section title="O"><p>o</p></Section>');
  // a negative check needs a bounded wait
  await new Promise((r) => setTimeout(r, 1000));
  expect(reloaded()).toBe(false);
});

it('an .md file outside the scanned dirs is ignored', { timeout: 15_000 }, async () => {
  send.mockClear();
  writeFileSync(join(tmp, 'app/other.zukan.md'), '# O');
  await new Promise((r) => setTimeout(r, 1000));
  expect(reloaded()).toBe(false);
});

it('editing a section title updates the metadata', { timeout: 15_000 }, async () => {
  expect(await meta('app/A')).toContain('"title":"A"');
  send.mockClear();
  writeFileSync(join(tmp, 'app/src/A.zukan.svelte'), '<Section title="A2"><p>a</p></Section>');
  await waitForReload();
  expect(await meta('app/A')).toContain('"title":"A2"');
});

it('editing an .md updates the metadata', { timeout: 20_000 }, async () => {
  // written before the server starts, so the edit below is a change, not a create
  await server.close();
  writeFileSync(join(tmp, 'app/src/A.zukan.md'), '# One');
  await start();
  expect(await meta('app/A')).toContain('<h1>One</h1>');
  send.mockClear();
  writeFileSync(join(tmp, 'app/src/A.zukan.md'), '# Two');
  await waitForReload();
  expect(await meta('app/A')).toContain('<h1>Two</h1>');
});

it('re-creating a deleted .md reloads only the catalog', { timeout: 20_000 }, async () => {
  send.mockClear();
  writeFileSync(join(tmp, 'app/src/A.zukan.md'), '# One');
  await waitForReload();
  await list();
  expect(await meta('app/A')).toContain('<h1>One</h1>');
  send.mockClear();
  rmSync(join(tmp, 'app/src/A.zukan.md'));
  await waitForReload();
  // the catalog reloads: the metadata no longer watches the file, whose module is left with no importers
  expect(await meta('app/A')).toContain('"doc":null');
  send.mockClear();
  writeFileSync(join(tmp, 'app/src/A.zukan.md'), '# Two');
  await waitForReload();
  await new Promise((r) => setTimeout(r, 300));
  expect(fullReloads()).toBe(0);
  expect(await meta('app/A')).toContain('<h1>Two</h1>');
});

it('re-creating a deleted catalog file reloads only the catalog', { timeout: 20_000 }, async () => {
  await list();
  send.mockClear();
  rmSync(join(tmp, 'app/src/A.zukan.svelte'));
  await waitForReload();
  await list();
  send.mockClear();
  writeFileSync(join(tmp, 'app/src/A.zukan.svelte'), '<Section title="A"><p>a</p></Section>');
  await waitForReload();
  await new Promise((r) => setTimeout(r, 300));
  expect(fullReloads()).toBe(0);
});

it('a deleted and re-created file has its new content', { timeout: 20_000 }, async () => {
  expect(await meta('app/A')).toContain('"title":"A"');
  send.mockClear();
  rmSync(join(tmp, 'app/src/A.zukan.svelte'));
  await waitForReload();
  send.mockClear();
  writeFileSync(join(tmp, 'app/src/A.zukan.svelte'), '<Section title="B"><p>b</p></Section>');
  await waitForReload();
  expect(await meta('app/A')).toContain('"title":"B"');
  expect(await list()).toContain('A.zukan.svelte');
});

it('a group outside the root is watched', { timeout: 20_000 }, async () => {
  await server.close();
  await mkdir(join(tmp, 'outside'));
  writeFileSync(join(tmp, 'outside/O.zukan.svelte'), '<Section title="O"><p>o</p></Section>');
  await start({ groups: { app: 'src', out: '../outside' } });
  expect(await list()).toContain('O.zukan.svelte');
  send.mockClear();
  writeFileSync(join(tmp, 'outside/P.zukan.svelte'), '<Section title="P"><p>p</p></Section>');
  await waitForReload();
  expect(await list()).toContain('P.zukan.svelte');
  expect(fullReloads()).toBe(0);
});

// macOS opens a decomposed name by its composed spelling; Linux and Windows find neither by the other
it('a groups dir written in another Unicode normalization keeps its HMR', { timeout: 20_000 }, async ({ skip }) => {
  const [nfc, nfd] = ['Café', 'Café'.normalize('NFD')];
  const file = join(tmp, `app/src/${nfd}/A.zukan.svelte`);
  mkdirSync(dirname(file));
  writeFileSync(file, '<Section title="A"><p>a</p></Section>');
  if (!existsSync(join(tmp, `app/src/${nfc}`))) skip();
  await server.close();
  await start({ groups: { ui: `src/${nfc}` } });
  await list();
  send.mockClear();
  writeFileSync(file, '<Section title="A"><p>changed</p></Section>');
  await waitForReload();
});

it('a component in a groups dir linked through node_modules updates its props', { timeout: 25_000 }, async () => {
  await server.close();
  await mkdir(join(tmp, 'ui/src'), { recursive: true });
  const component = join(tmp, 'ui/src/B.svelte');
  writeFileSync(join(tmp, 'ui/src/B.zukan.svelte'), '<Section title="B"><p>b</p></Section>');
  writeFileSync(component, '<script lang="ts">\n  let { a }: { a: number } = $props();\n</script>\n<p>{a}</p>');
  await mkdir(join(tmp, 'app/node_modules'), { recursive: true });
  symlinkSync(join(tmp, 'ui'), join(tmp, 'app/node_modules/ui'), 'junction');
  await start({ groups: { ui: 'node_modules/ui/src' } });
  expect(await meta('ui/B')).toContain('"name":"a"');
  send.mockClear();
  writeFileSync(
    component,
    '<script lang="ts">\n  let { a, b }: { a: number; b?: string } = $props();\n</script>\n<p>{a}</p>'
  );
  await waitForReload();
  expect(fullReloads()).toBe(0);
  expect(await meta('ui/B')).toContain('"name":"b"');
});

it(
  'a props type file outside a groups dir linked through node_modules updates the props',
  { timeout: 25_000 },
  async () => {
    await server.close();
    await mkdir(join(tmp, 'ui/src/lib'), { recursive: true });
    const types = join(tmp, 'ui/src/types.ts');
    writeFileSync(types, 'export type Props = { a: number };');
    writeFileSync(join(tmp, 'ui/src/lib/B.zukan.svelte'), '<Section title="B"><p>b</p></Section>');
    writeFileSync(
      join(tmp, 'ui/src/lib/B.svelte'),
      '<script lang="ts">\n  import type { Props } from \'../types\';\n  let { a }: Props = $props();\n</script>\n<p>{a}</p>'
    );
    await mkdir(join(tmp, 'app/node_modules'), { recursive: true });
    symlinkSync(join(tmp, 'ui'), join(tmp, 'app/node_modules/ui'), 'junction');
    await start({ groups: { ui: 'node_modules/ui/src/lib' } });
    expect(await meta('ui/B')).toContain('"name":"a"');
    // chokidar registers an added path asynchronously, and a write before that is never reported
    await expect
      .poll(() =>
        Object.entries(server.watcher.getWatched()).some(
          ([dir, names]) => normalizePath(dir) === normalizePath(join(tmp, 'ui/src')) && names.includes('types.ts')
        )
      )
      .toBe(true);
    send.mockClear();
    writeFileSync(types, 'export type Props = { a: number; b?: string };');
    await waitForReload();
    expect(fullReloads()).toBe(0);
    expect(await meta('ui/B')).toContain('"name":"b"');
  }
);

it(
  'changing the props of the component updates the metadata; other edits leave it alone',
  { timeout: 25_000 },
  async () => {
    // written before the server starts, so the edits below are changes, not creates
    await server.close();
    const component = join(tmp, 'app/src/A.svelte');
    writeFileSync(component, '<script lang="ts">\n  let { a }: { a: number } = $props();\n</script>\n<p>{a}</p>');
    await start();
    expect(await meta('app/A')).toContain('"name":"a"');
    send.mockClear();
    writeFileSync(component, '<script lang="ts">\n  let { a }: { a: number } = $props();\n</script>\n<b>{a}</b>');
    await new Promise((r) => setTimeout(r, 1000));
    expect(reloaded()).toBe(false);
    writeFileSync(
      component,
      '<script lang="ts">\n  let { a, b }: { a: number; b?: string } = $props();\n</script>\n<b>{a}</b>'
    );
    await waitForReload();
    expect(fullReloads()).toBe(0);
    expect(await meta('app/A')).toContain('"name":"b"');
  }
);

it(
  'a new component without a catalog file updates the list, and Vite still handles the file',
  { timeout: 15_000 },
  async () => {
    expect(await list()).toContain('export const uncataloged = []');
    send.mockClear();
    writeFileSync(join(tmp, 'app/src/Lone.svelte'), '<p>lone</p>');
    await waitForReload();
    expect(fullReloads()).toBe(0);
    expect(await list()).toContain('"file":"src/Lone.svelte"');
  }
);

/** links a package of this repository into the temporary app, the way pnpm would */
const link = (name: string) => {
  const at = join(tmp, 'app/node_modules', name);
  mkdirSync(dirname(at), { recursive: true });
  symlinkSync(findPackage(name, import.meta.dirname)!, at, 'junction');
};

const updated = (url: string) =>
  send.mock.calls.some(([p]: unknown[]) =>
    (p as { updates?: { path: string }[] })?.updates?.some((u) => u.path === url)
  );

/** a request through the dev server's middlewares, as a page makes it; rejected when they all pass it on */
const get = (url: string) =>
  new Promise<string>((resolve, reject) => {
    const res = {
      statusCode: 200,
      getHeader() {},
      setHeader() {},
      end: (body: string | Buffer) => resolve(String(body))
    };
    server.middlewares({ url, method: 'GET', headers: { host: 'localhost' } } as never, res as never, reject);
  });

describe('modules shared with the app', () => {
  /** restarts the server with Svelte, a page of the app that imports the catalog file, and every module loaded */
  async function withApp(svelteOptions: Parameters<typeof svelte>[0] = {}) {
    await server.close();
    link('svelte');
    writeFileSync(join(tmp, 'app/src/main.js'), "import A from './A.zukan.svelte';\nexport default A;\n");
    await start({}, { plugins: [svelte(svelteOptions)] });
    const env = server.environments.client;
    for (const id of [ENTRY, 'virtual:svelte-zukan/catalog', '/src/A.zukan.svelte']) await env.transformRequest(id);
  }

  it('an app page that imports a catalog file still hot-updates it', { timeout: 25_000 }, async () => {
    await withApp();
    await server.environments.client.transformRequest('/src/main.js');
    send.mockClear();
    writeFileSync(join(tmp, 'app/src/A.zukan.svelte'), '<Section title="A"><p>changed</p></Section>');
    await waitForReload();
    await expect.poll(() => updated('/src/A.zukan.svelte'), { timeout: 10_000 }).toBe(true);
    await new Promise((r) => setTimeout(r, 300));
    expect(fullReloads()).toBe(0);
  });

  // without Svelte's HMR the file accepts no update, and the catalog's chain of imports ends at the entry
  it(
    'a catalog file only the catalog imports does not reload the app, even without HMR',
    { timeout: 25_000 },
    async () => {
      await withApp({ compilerOptions: { hmr: false } });
      // its detail page watches the file through the meta module, which is the catalog's too
      await meta('app/A');
      send.mockClear();
      writeFileSync(join(tmp, 'app/src/A.zukan.svelte'), '<Section title="A"><p>changed</p></Section>');
      await waitForReload();
      await new Promise((r) => setTimeout(r, 300));
      expect(fullReloads()).toBe(0);
    }
  );

  it.each([false, true])(
    "a catalog file that fails to compile sends Vite's error to every tab only when the app imports it (%s)",
    { timeout: 25_000 },
    async (imported) => {
      await server.close();
      link('svelte');
      writeFileSync(
        join(tmp, 'app/src/A.zukan.svelte'),
        '<script>\n  let n = 1;\n  n = $state(2);\n</script>\n<Section title="A"><p>{n}</p></Section>'
      );
      writeFileSync(join(tmp, 'app/src/main.js'), "import A from './A.zukan.svelte';\nexport default A;\n");
      await start({}, { plugins: [svelte()] });
      await list();
      if (imported) await server.environments.client.transformRequest('/src/main.js');
      send.mockClear();
      const body = await get('/src/A.zukan.svelte').catch(() => null);
      expect(errors()).toHaveLength(imported ? 1 : 0);
      // the preview's import fails with the compiler's message
      if (!imported) expect(body).toMatch(/^throw new Error\(".*`\$state\(\.\.\.\)` can only be used/);
    }
  );

  it(
    'a component only a catalog file imports keeps its compile error off the app and reloads the catalog once fixed',
    { timeout: 25_000 },
    async () => {
      await server.close();
      link('svelte');
      const inner = join(tmp, 'app/src/Inner.svelte');
      writeFileSync(inner, '<script>\n  let n = 1;\n  n = $state(2);\n</script>\n<p>{n}</p>');
      writeFileSync(
        join(tmp, 'app/src/A.zukan.svelte'),
        '<script>\n  import Inner from \'./Inner.svelte\';\n</script>\n<Section title="A"><Inner /></Section>'
      );
      await start({}, { plugins: [svelte()] });
      await list();
      await server.environments.client.transformRequest('/src/A.zukan.svelte');
      send.mockClear();
      expect(await get('/src/Inner.svelte')).toMatch(/^throw new Error\(/);
      expect(errors()).toHaveLength(0);
      writeFileSync(inner, '<script>\n  let n = $state(2);\n</script>\n<p>{n}</p>');
      await waitForReload();
      await new Promise((r) => setTimeout(r, 300));
      expect(fullReloads()).toBe(0);
    }
  );

  /** restarts the server with B.svelte, which only its catalog file imports, or the app's page too */
  async function withComponent({ served = false, inApp = false } = {}) {
    await server.close();
    link('svelte');
    const component = join(tmp, 'app/src/B.svelte');
    writeFileSync(component, '<p>b</p>\n');
    writeFileSync(
      join(tmp, 'app/src/B.zukan.svelte'),
      '<script>\n  import B from \'./B.svelte\';\n</script>\n<Section title="B"><B /></Section>'
    );
    writeFileSync(join(tmp, 'app/src/main.js'), inApp ? "import './B.svelte';\n" : 'export default 1;\n');
    await start({}, { plugins: [svelte()] });
    await list();
    const env = server.environments.client;
    for (const id of ['/src/main.js', '/src/B.zukan.svelte', '/src/B.svelte']) await env.transformRequest(id);
    if (served) await meta('app/B');
    send.mockClear();
    return component;
  }

  describe.each([false, true])('a component only a catalog file imports (props served: %s)', (served) => {
    it.each([
      ['an unclosed block', '{#if}\n'],
      ['a duplicate declaration', '<script>\n  let a;\n  let a;\n</script>\n'],
      ['a missing import', "<script>\n  import './missing.js';\n</script>\n"]
    ])('an edit with %s reloads only the catalog, also once fixed', { timeout: 30_000 }, async (_, broken) => {
      const component = await withComponent({ served });
      writeFileSync(component, broken);
      await waitForReload();
      await new Promise((r) => setTimeout(r, 300));
      expect(errors()).toHaveLength(0);
      expect(fullReloads()).toBe(0);
      expect(await get('/src/B.svelte')).toMatch(/^throw new Error\(/);
      send.mockClear();
      writeFileSync(component, '<p>fixed</p>\n');
      await waitForReload();
      await new Promise((r) => setTimeout(r, 300));
      expect(errors()).toHaveLength(0);
      expect(fullReloads()).toBe(0);
      expect(await get('/src/B.svelte')).not.toMatch(/^throw /);
    });

    it('an edit that compiles keeps its own HMR, with no reload', { timeout: 25_000 }, async () => {
      const component = await withComponent({ served });
      writeFileSync(component, '<p>changed</p>\n');
      await expect.poll(() => updated('/src/B.svelte'), { timeout: 10_000 }).toBe(true);
      await new Promise((r) => setTimeout(r, 300));
      expect(reloaded()).toBe(false);
      expect(fullReloads()).toBe(0);
    });
  });

  it("a compile error in a component the app imports stays Vite's error", { timeout: 25_000 }, async () => {
    const component = await withComponent({ inApp: true });
    writeFileSync(component, '{#if}\n');
    await expect.poll(() => errors().length, { timeout: 10_000 }).toBe(1);
    expect(reloaded()).toBe(false);
  });

  // without the names, the import would fail to link ("does not provide an export named") before the module throws
  it(
    'a module only a catalog file imports by name throws its compile error, not a link error',
    { timeout: 25_000 },
    async () => {
      await server.close();
      link('svelte');
      writeFileSync(join(tmp, 'app/src/bad.ts'), 'export const x = ;\n');
      writeFileSync(
        join(tmp, 'app/src/A.zukan.svelte'),
        "<script>\n  import { x, y as z, 'a-b' as ab } from './bad.ts';\n</script>\n<Section title=\"A\"><p>{x}{z}{ab}</p></Section>"
      );
      await start({}, { plugins: [svelte()] });
      await list();
      await server.environments.client.transformRequest('/src/A.zukan.svelte');
      const body = await get('/src/bad.ts');
      expect(body).not.toContain(tmp);
      const data = (code: string) => 'data:text/javascript,' + encodeURIComponent(code);
      const importer = `import { x, y, 'a-b' as ab } from ${JSON.stringify(data(body))}; export default [x, y, ab];`;
      // the path is relative to the root, as Oxc's relative to the working directory is not
      await expect(import(/* @vite-ignore */ data(importer))).rejects.toThrow(/\[ src[\\/]bad\.ts:1:18 \]/);
    }
  );

  it(
    'a module only a catalog file reaches through `export *` also throws its compile error, not a link error',
    { timeout: 25_000 },
    async () => {
      await server.close();
      link('svelte');
      writeFileSync(join(tmp, 'app/src/bad.ts'), 'export const x = ;\n');
      // two levels, and a cycle the search has to end on
      writeFileSync(join(tmp, 'app/src/mid.ts'), "export * from './bad.ts';\nexport * from './cycle.ts';\n");
      writeFileSync(join(tmp, 'app/src/cycle.ts'), "export * from './mid.ts';\n");
      writeFileSync(join(tmp, 'app/src/outer.ts'), "export * from './mid.ts';\n");
      writeFileSync(join(tmp, 'app/src/named.ts'), "export * as ns from './bad.ts';\nexport const z = 1;\n");
      writeFileSync(
        join(tmp, 'app/src/A.zukan.svelte'),
        "<script>\n  import { x } from './mid.ts';\n  import { y } from './outer.ts';\n  import { z } from './named.ts';\n</script>\n<Section title=\"A\"><p>{x}{y}{z}</p></Section>"
      );
      await start({}, { plugins: [svelte()] });
      await list();
      for (const id of ['/src/A.zukan.svelte', '/src/outer.ts', '/src/mid.ts', '/src/cycle.ts', '/src/named.ts'])
        await server.environments.client.transformRequest(id);
      const body = await get('/src/bad.ts');
      const data = (code: string) => 'data:text/javascript,' + encodeURIComponent(code);
      const importer = `import { x, y } from ${JSON.stringify(data(body))}; export default [x, y];`;
      await expect(import(/* @vite-ignore */ data(importer))).rejects.toThrow(/\[ src[\\/]bad\.ts:1:18 \]/);
      // `export * as` names the module itself, so what its importers import is not asked of the failed module
      expect(body).not.toContain('"z"');
    }
  );

  it(
    'a stylesheet only a catalog file imports reloads the catalog once its error is fixed',
    { timeout: 25_000 },
    async () => {
      await server.close();
      link('svelte');
      const inner = join(tmp, 'app/src/Inner.css');
      writeFileSync(inner, "@import './missing.css';\np { color: red }\n");
      writeFileSync(
        join(tmp, 'app/src/A.zukan.svelte'),
        '<script>\n  import \'./Inner.css\';\n</script>\n<Section title="A"><p>a</p></Section>'
      );
      await start({}, { plugins: [svelte()] });
      await list();
      await server.environments.client.transformRequest('/src/A.zukan.svelte');
      send.mockClear();
      expect(await get('/src/Inner.css')).toMatch(/^throw new Error\(/);
      expect(errors()).toHaveLength(0);
      writeFileSync(inner, 'p { color: blue }\n');
      await waitForReload();
      await new Promise((r) => setTimeout(r, 300));
      expect(fullReloads()).toBe(0);
    }
  );

  it.each([
    ['helper.js', "import { n } from './helper.js';", '{n}', 'export const n = 1;\n'],
    ['Inner.svelte', "import Inner from './Inner.svelte';", '<Inner />', '<p>inner</p>\n'],
    ['Inner.css', "import './Inner.css';", 'a', 'p { color: red }\n']
  ])(
    'creating the missing import %s of a catalog file reloads only the catalog',
    { timeout: 25_000 },
    async (name, imports, body, source) => {
      await server.close();
      link('svelte');
      writeFileSync(
        join(tmp, 'app/src/A.zukan.svelte'),
        `<script>\n  ${imports}\n</script>\n<Section title="A"><p>${body}</p></Section>`
      );
      await start({}, { plugins: [svelte()] });
      await list();
      send.mockClear();
      expect(await get('/src/A.zukan.svelte')).toMatch(new RegExp(`^throw new Error\\(.*${name.replace('.', '\\.')}`));
      expect(errors()).toHaveLength(0);
      writeFileSync(join(tmp, 'app/src', name), source);
      await waitForReload();
      await new Promise((r) => setTimeout(r, 300));
      expect(fullReloads()).toBe(0);
      // fixed: the failure is no longer tracked, so its next change goes through the app's own HMR
      send.mockClear();
      expect(await get('/src/A.zukan.svelte')).not.toMatch(/^throw /);
    }
  );

  it.each([
    ['Inner.css', 'p { color: red }\n'],
    ['helper.js', 'export const n = 1;\n'],
    ['Inner.svelte', '<p>inner</p>\n']
  ])(
    'creating the missing import %s of a catalog file and of an app entry recovers the app too',
    { timeout: 25_000 },
    async (name, source) => {
      await server.close();
      link('svelte');
      writeFileSync(
        join(tmp, 'app/src/A.zukan.svelte'),
        `<script>\n  import './${name}';\n</script>\n<Section title="A"><p>a</p></Section>`
      );
      writeFileSync(join(tmp, 'app/src/main.js'), `import './${name}';\n`);
      await start({}, { plugins: [svelte()] });
      await list();
      await server.environments.client.transformRequest('/src/main.js').catch(() => {});
      send.mockClear();
      expect(await get('/src/A.zukan.svelte')).toMatch(/^throw new Error\(/);
      writeFileSync(join(tmp, 'app/src', name), source);
      await waitForReload();
      // the entry accepts no update: Vite reloads the app, as it does without the catalog
      await expect.poll(fullReloads, { timeout: 10_000 }).toBeGreaterThan(0);
    }
  );

  it('editing the logo reloads only the catalog', { timeout: 25_000 }, async () => {
    await server.close();
    link('svelte');
    writeFileSync(join(tmp, 'app/logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    await start({ logo: 'logo.svg' });
    const env = server.environments.client;
    for (const id of [ENTRY, '/logo.svg?url']) await env.transformRequest(id);
    send.mockClear();
    writeFileSync(join(tmp, 'app/logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="1"/>');
    await waitForReload();
    await new Promise((r) => setTimeout(r, 300));
    expect(fullReloads()).toBe(0);
  });

  it('a logo the app imports too keeps its own HMR and reloads only the catalog', { timeout: 25_000 }, async () => {
    await server.close();
    link('svelte');
    writeFileSync(join(tmp, 'app/src/logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    writeFileSync(
      join(tmp, 'app/src/Logo.svelte'),
      '<script>\n  import logo from \'./logo.svg?url\';\n</script>\n<img src={logo} alt="" />'
    );
    await start({ logo: 'src/logo.svg' }, { plugins: [svelte()] });
    const env = server.environments.client;
    for (const id of [ENTRY, '/src/Logo.svelte']) await env.transformRequest(id);
    send.mockClear();
    writeFileSync(join(tmp, 'app/src/logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="1"/>');
    await waitForReload();
    await expect.poll(() => updated('/src/Logo.svelte'), { timeout: 10_000 }).toBe(true);
    await new Promise((r) => setTimeout(r, 300));
    expect(fullReloads()).toBe(0);
  });

  it(
    'a logo in publicDir is served without a warning, and editing it reloads only the catalog',
    { timeout: 25_000 },
    async () => {
      await server.close();
      link('svelte');
      mkdirSync(join(tmp, 'app/public'));
      // over Vite's inline limit, so that the page requests the file itself
      writeFileSync(
        join(tmp, 'app/public/logo.svg'),
        `<svg xmlns="http://www.w3.org/2000/svg"><!--${'x'.repeat(5000)}--></svg>`
      );
      await start({ logo: 'public/logo.svg' });
      const warn = vi.spyOn(server.config.logger, 'warn');
      const entry = await get('/@id/__x00__' + ENTRY);
      expect(entry).toContain('logo: "/logo.svg",');
      expect(entry).not.toContain('import logo');
      expect(warn).not.toHaveBeenCalled();
      send.mockClear();
      writeFileSync(join(tmp, 'app/public/logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="1"/>');
      await waitForReload();
      await new Promise((r) => setTimeout(r, 300));
      expect(fullReloads()).toBe(0);
    }
  );
});

const errors = () => send.mock.calls.filter(([p]: unknown[]) => (p as { type?: string })?.type === 'error');

// `@tailwindcss/vite` calls `addWatchFile` on every file it scans, which makes the stylesheet an importer of each
describe('with @tailwindcss/vite', () => {
  const catalogFile = '<script>\n  import B from \'./B.svelte\';\n</script>\n<Section title="B"><B /></Section>';

  /** restarts the server with B.svelte and its catalog file, and an app that uses a Tailwind CSS stylesheet */
  async function withApp(main: string) {
    await server.close();
    for (const name of ['svelte', 'tailwindcss', '@tailwindcss/node']) link(name);
    writeFileSync(join(tmp, 'app/src/app.css'), '@import "tailwindcss";\n');
    writeFileSync(join(tmp, 'app/src/main.js'), `import './app.css';\n${main}`);
    writeFileSync(join(tmp, 'app/src/B.svelte'), '<p>b</p>\n');
    writeFileSync(join(tmp, 'app/src/B.zukan.svelte'), catalogFile);
    await start({}, { plugins: [tailwindcss(), svelte()] });
    await list();
    const env = server.environments.client;
    for (const id of ['/src/main.js', '/src/app.css', '/src/B.zukan.svelte', '/src/B.svelte'])
      await env.transformRequest(id);
    for (const file of ['B.zukan.svelte', 'B.svelte', 'main.js']) {
      const mods = env.moduleGraph.getModulesByFile(normalizePath(join(tmp, 'app/src', file)))!;
      expect([...mods].flatMap((m) => [...m.importers].map((i) => i.url))).toContain('/src/app.css');
    }
    send.mockClear();
  }

  it(
    'a missing import in a catalog file keeps off the app, shows its message and reloads only the catalog once fixed',
    { timeout: 30_000 },
    async () => {
      await withApp('');
      writeFileSync(
        join(tmp, 'app/src/B.zukan.svelte'),
        catalogFile.replace('<script>\n', "<script>\n  import './missing.js';\n")
      );
      await waitForReload();
      await new Promise((r) => setTimeout(r, 300));
      expect(await get('/src/B.zukan.svelte')).toMatch(/^throw new Error\(.*missing\.js/);
      expect(errors()).toHaveLength(0);
      expect(fullReloads()).toBe(0);
      send.mockClear();
      writeFileSync(join(tmp, 'app/src/B.zukan.svelte'), catalogFile);
      await waitForReload();
      await new Promise((r) => setTimeout(r, 300));
      expect(errors()).toHaveLength(0);
      expect(fullReloads()).toBe(0);
      expect(await get('/src/B.zukan.svelte')).not.toMatch(/^throw /);
    }
  );

  it('a compile error in a component only a catalog file imports keeps off the app', { timeout: 30_000 }, async () => {
    await withApp('');
    writeFileSync(join(tmp, 'app/src/B.svelte'), '{#if}\n');
    await waitForReload();
    await new Promise((r) => setTimeout(r, 300));
    expect(errors()).toHaveLength(0);
    expect(fullReloads()).toBe(0);
    expect(await get('/src/B.svelte')).toMatch(/^throw new Error\(/);
  });

  it("a compile error in a component the app imports stays Vite's error", { timeout: 30_000 }, async () => {
    await withApp("import './B.svelte';\n");
    writeFileSync(join(tmp, 'app/src/B.svelte'), '{#if}\n');
    await expect.poll(() => errors().length, { timeout: 10_000 }).toBe(1);
    expect(reloaded()).toBe(false);
  });

  it("a missing import in a component the app imports stays Vite's error", { timeout: 30_000 }, async () => {
    await withApp("import './B.svelte';\n");
    writeFileSync(join(tmp, 'app/src/B.svelte'), "<script>\n  import './missing.js';\n</script>\n<p>b</p>\n");
    await new Promise((r) => setTimeout(r, 1000));
    send.mockClear();
    await get('/src/B.svelte').catch(() => {});
    expect(errors()).toHaveLength(1);
  });

  // what `@import` makes an importer is a real import, unlike `addWatchFile`
  it("a stylesheet only the app's stylesheet imports stays Vite's error", { timeout: 30_000 }, async () => {
    await withApp('');
    const inner = join(tmp, 'app/src/inner.css');
    writeFileSync(inner, 'p { color: red }\n');
    writeFileSync(join(tmp, 'app/src/app.css'), '@import "tailwindcss";\n@import "./inner.css";\n');
    await new Promise((r) => setTimeout(r, 1000));
    const env = server.environments.client;
    await env.transformRequest('/src/app.css');
    expect(
      [...env.moduleGraph.getModulesByFile(normalizePath(inner))!].flatMap((m) => [...m.importers].map((i) => i.url))
    ).toContain('/src/app.css');
    send.mockClear();
    writeFileSync(inner, '@import "./missing.css";\np { color: red }\n');
    await new Promise((r) => setTimeout(r, 1000));
    await get('/src/app.css').catch(() => {});
    expect(errors()).toHaveLength(1);
  });

  it.each([
    ['catalog file', 'B.zukan.svelte', catalogFile],
    ['.md', 'B.zukan.md', '# B']
  ])('re-creating a deleted %s reloads only the catalog', { timeout: 30_000 }, async (_, name, source) => {
    await withApp('');
    const file = join(tmp, 'app/src', name);
    writeFileSync(file, source);
    await waitForReload();
    const env = server.environments.client;
    // Tailwind CSS scans the file, and the catalog reads it
    const load = async () => {
      env.moduleGraph.invalidateAll();
      await list();
      // none while the catalog file is deleted
      await meta('app/B').catch(() => {});
      for (const id of ['/src/main.js', '/src/app.css']) await env.transformRequest(id);
    };
    await load();
    send.mockClear();
    rmSync(file);
    await waitForReload();
    await load();
    send.mockClear();
    writeFileSync(file, source);
    await waitForReload();
    await new Promise((r) => setTimeout(r, 300));
    expect(fullReloads()).toBe(0);
  });

  it('a stylesheet only a catalog file imports keeps its error off the app', { timeout: 30_000 }, async () => {
    await withApp('');
    const css = join(tmp, 'app/src/only.css');
    writeFileSync(css, 'p { color: red }\n');
    writeFileSync(
      join(tmp, 'app/src/B.zukan.svelte'),
      catalogFile.replace('<script>\n', "<script>\n  import './only.css';\n")
    );
    await new Promise((r) => setTimeout(r, 1000));
    const env = server.environments.client;
    // scanned again, now that the file exists
    env.moduleGraph.invalidateAll();
    for (const id of ['/src/app.css', '/src/B.zukan.svelte', '/src/only.css']) await env.transformRequest(id);
    writeFileSync(css, '@import "./missing.css";\np { color: red }\n');
    await new Promise((r) => setTimeout(r, 1000));
    send.mockClear();
    expect(await get('/src/only.css')).toMatch(/^throw new Error\(/);
    expect(errors()).toHaveLength(0);
  });

  it(
    'a stylesheet a catalog file imports through another keeps its error off the app',
    { timeout: 30_000 },
    async () => {
      await withApp('');
      const inner = join(tmp, 'app/src/inner.css');
      writeFileSync(inner, 'p { color: red }\n');
      writeFileSync(join(tmp, 'app/src/outer.css'), '@import "./inner.css";\n');
      writeFileSync(
        join(tmp, 'app/src/B.zukan.svelte'),
        catalogFile.replace('<script>\n', "<script>\n  import './outer.css';\n")
      );
      await new Promise((r) => setTimeout(r, 1000));
      const env = server.environments.client;
      await env.transformRequest('/src/B.zukan.svelte');
      await env.transformRequest('/src/outer.css');
      send.mockClear();
      writeFileSync(inner, '@import "./missing.css";\np { color: red }\n');
      await new Promise((r) => setTimeout(r, 1000));
      send.mockClear();
      expect(await get('/src/outer.css')).toMatch(/^throw new Error\(/);
      expect(errors()).toHaveLength(0);
    }
  );
});

/** restarts the server with A.svelte reading its props type from types.ts */
async function withPropsType() {
  await server.close();
  const types = join(tmp, 'app/src/types.ts');
  writeFileSync(types, 'export type Props = { a: number };\n');
  writeFileSync(
    join(tmp, 'app/src/A.svelte'),
    '<script lang="ts">\n  import type { Props } from \'./types\';\n  let { a }: Props = $props();\n</script>\n<p>{a}</p>'
  );
  await start();
  return types;
}

// the catalog page imports the list, which imports each meta module: an import of types.ts by the meta module would
// end its update in `full-reload`
it.each([false, true])(
  'changing an imported props type updates the metadata (list loaded: %s)',
  { timeout: 25_000 },
  async (withList) => {
    const types = await withPropsType();
    if (withList) await list();
    expect(await meta('app/A')).toContain('"name":"a","type":"number"');
    send.mockClear();
    writeFileSync(types, 'export type Props = { a: number; /** new */ b?: string };\n');
    await waitForReload();
    // Vite would send `full-reload` right after the plugin's hook
    await new Promise((r) => setTimeout(r, 300));
    expect(fullReloads()).toBe(0);
    expect(await meta('app/A')).toContain('"name":"b","type":"string"');
  }
);

it.each([
  ['inside the root', 'app/src/lib'],
  ['outside the root', 'shared']
])('changing a props type behind a `$lib` alias %s updates the metadata', { timeout: 25_000 }, async (_, dir) => {
  await server.close();
  const lib = join(tmp, dir);
  mkdirSync(lib, { recursive: true });
  const types = join(lib, 'types.ts');
  writeFileSync(types, 'export type Props = { a: number };\n');
  writeFileSync(
    join(tmp, 'app/src/A.svelte'),
    '<script lang="ts">\n  import type { Props } from \'$lib/types.js\';\n  let { a }: Props = $props();\n</script>\n<p>{a}</p>'
  );
  await start({}, { resolve: { alias: [{ find: '$lib', replacement: lib }] } });
  expect(await meta('app/A')).toContain('"name":"a","type":"number"');
  expect(await meta('app/A')).toContain('"propsType":null');
  send.mockClear();
  writeFileSync(types, 'export type Props = { a: number; b?: string };\n');
  await waitForReload();
  await new Promise((r) => setTimeout(r, 300));
  expect(fullReloads()).toBe(0);
  expect(await meta('app/A')).toContain('"name":"b","type":"string"');
});

it('a props type file deleted or created while the server runs updates the metadata', { timeout: 25_000 }, async () => {
  const types = await withPropsType();
  await list();
  expect(await meta('app/A')).toContain('"name":"a","type":"number"');
  send.mockClear();
  rmSync(types);
  await waitForReload();
  expect(await meta('app/A')).toContain('"name":"a","type":null');
  send.mockClear();
  writeFileSync(types, 'export type Props = { a: string };\n');
  await waitForReload();
  expect(fullReloads()).toBe(0);
  expect(await meta('app/A')).toContain('"name":"a","type":"string"');
});

it('editing a props type after its component is deleted is not an error', { timeout: 25_000 }, async () => {
  const types = await withPropsType();
  await list();
  expect(await meta('app/A')).toContain('"name":"a"');
  send.mockClear();
  rmSync(join(tmp, 'app/src/A.svelte'));
  await waitForReload();
  // the meta module does not import the component, so deleting it reloads only the catalog tab
  await new Promise((r) => setTimeout(r, 500));
  expect(fullReloads()).toBe(0);
  expect(await meta('app/A')).toContain('"props":null');
  for (const b of ['string', 'number']) {
    writeFileSync(types, `export type Props = { a: number; b?: ${b} };\n`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  expect(errors()).toEqual([]);
});

it('a component created next to a served catalog file gets its props table', { timeout: 15_000 }, async () => {
  await list();
  expect(await meta('app/A')).toContain('"props":null');
  send.mockClear();
  writeFileSync(join(tmp, 'app/src/A.svelte'), '<script lang="ts">\n  let { a }: { a: number } = $props();\n</script>');
  await waitForReload();
  expect(await meta('app/A')).toContain('"name":"a","type":"number"');
});

it('route files and tests that the list leaves out do not reload the catalog', { timeout: 15_000 }, async () => {
  await list();
  send.mockClear();
  mkdirSync(join(tmp, 'app/src/routes/about'), { recursive: true });
  writeFileSync(join(tmp, 'app/src/routes/about/+page.svelte'), '<p>about</p>');
  writeFileSync(join(tmp, 'app/src/routes/Nav.svelte'), '<p>nav</p>');
  writeFileSync(join(tmp, 'app/src/+layout.svelte'), '<slot />');
  writeFileSync(join(tmp, 'app/src/A.test.svelte'), '<p>test</p>');
  // a negative check needs a bounded wait
  await new Promise((r) => setTimeout(r, 1000));
  expect(reloaded()).toBe(false);
});

describe('Tailwind CSS', () => {
  const brand = '@import "tailwindcss";\n@theme { --color-brand: #ff3e00; }\n';

  /** restarts the server with Tailwind linked into the app and `files` (relative to the temp dir) written */
  async function withTailwind(files: Record<string, string>, config: InlineConfig = {}) {
    await server.close();
    for (const name of ['tailwindcss', '@tailwindcss/node']) {
      const at = join(tmp, 'app/node_modules', name);
      mkdirSync(dirname(at), { recursive: true });
      symlinkSync(findPackage(name, import.meta.dirname)!, at, 'junction');
    }
    for (const [file, content] of Object.entries(files)) {
      mkdirSync(dirname(join(tmp, file)), { recursive: true });
      writeFileSync(join(tmp, file), content);
    }
    await start({}, config);
  }

  const transform = async (id: string) => (await server.environments.client.transformRequest(id))!.code;
  const sourceIds = (code: string) => [...code.matchAll(/"id":"([0-9a-f]+)"/g)].map((m) => m[1]);
  const firstSource = async () => transform(TAILWIND_SOURCE + sourceIds(await transform(TAILWIND))[0]);
  type Data = { components: { id: string }[]; tailwind: Record<string, unknown>[] | null };
  const catalogJson = () =>
    new Promise<{ body: string; data: Data }>((resolve, reject) => {
      const res = {
        statusCode: 200,
        getHeader() {},
        setHeader() {},
        end: (body: string) => resolve({ body, data: JSON.parse(body) })
      };
      server.middlewares(
        { url: '/__zukan/catalog.json', method: 'GET', headers: { host: 'localhost' } } as never,
        res as never,
        reject
      );
    });
  const variables = (data: Data) => data.tailwind!.map((t) => t.variables as Record<string, string>);

  it("resolves and loads the Tailwind list and one entry's data", { timeout: 30_000 }, async () => {
    await withTailwind({ 'app/src/app.css': brand });
    const list = await transform(TAILWIND);
    expect(list).toContain('export const tailwind');
    expect(list).toContain('"file":"src/app.css","error":null');
    expect(list).toContain(TAILWIND_SOURCE);
    expect(list).not.toContain('#ff3e00');
    const data = await firstSource();
    expect(data).toContain('"--color-brand":"#ff3e00"');
    expect(data).toContain('"css":');
    await expect(transform(TAILWIND_SOURCE + 'nope')).rejects.toThrow(/no Tailwind CSS entry/);
  });

  it('serves catalog.json when an entry fails', { timeout: 30_000 }, async () => {
    await withTailwind({
      'app/src/app.css': brand,
      'app/src/broken.css': '@import "tailwindcss";\n@import "./missing.css";\n'
    });
    const { data } = await catalogJson();
    expect(data.components.map((c) => c.id)).toEqual(['app/A']);
    expect(data.tailwind!.map((t) => [t.file, t.error])).toEqual([
      ['src/app.css', undefined],
      ['src/broken.css', expect.stringContaining('missing.css')]
    ]);
    expect(variables(data)[0]['--color-brand']).toBe('#ff3e00');
  });

  it('keeps absolute paths and the sample CSS out of catalog.json', { timeout: 30_000 }, async () => {
    await withTailwind({
      'app/src/app.css': brand,
      'app/src/broken.css': '@import "tailwindcss";\n@import "./missing.css";\n'
    });
    const { body, data } = await catalogJson();
    expect(body).not.toContain(tmp);
    expect(data.tailwind!.map((t) => Object.keys(t))).toEqual([
      ['file', 'version', 'prefix', 'categories', 'variables'],
      ['file', 'version', 'prefix', 'categories', 'variables', 'error']
    ]);
    expect(body).not.toContain('@layer');
  });

  it('resolves CSS imports through Vite aliases', { timeout: 30_000 }, async () => {
    await withTailwind(
      {
        'app/src/app.css': '@import "tailwindcss";\n@import "$lib/theme.css";\n',
        'app/src/lib/theme.css': '@theme { --color-aliased: red; }\n'
      },
      { resolve: { alias: { $lib: join(tmp, 'app/src/lib') } } }
    );
    const { data } = await catalogJson();
    // theme.css is a partial of app.css, not an entry of its own
    expect(data.tailwind!.map((t) => [t.file, t.error])).toEqual([['src/app.css', undefined]]);
    expect(variables(data)[0]['--color-aliased']).toBe('red');
  });

  it('reloads the catalog when a watched file changes the data', { timeout: 30_000 }, async () => {
    await withTailwind({ 'app/src/app.css': brand });
    await transform(TAILWIND);
    send.mockClear();
    writeFileSync(join(tmp, 'app/src/app.css'), brand.replace('#ff3e00', '#000'));
    await waitForReload();
    expect(fullReloads()).toBe(0);
    expect(await firstSource()).toContain('"--color-brand":"#000"');
  });

  it('does not reload when the data did not change', { timeout: 30_000 }, async () => {
    await withTailwind({ 'app/src/app.css': brand });
    await transform(TAILWIND);
    send.mockClear();
    writeFileSync(join(tmp, 'app/src/app.css'), brand + '/* a comment */\n');
    await new Promise((r) => setTimeout(r, 2000));
    expect(reloaded()).toBe(false);
    // the same file still reloads once its data changes
    writeFileSync(join(tmp, 'app/src/app.css'), brand.replace('#ff3e00', '#000'));
    await waitForReload();
  });

  it('picks up a CSS entry created in a searched dir', { timeout: 30_000 }, async () => {
    await withTailwind({ 'app/src/app.css': brand });
    await transform(TAILWIND);
    send.mockClear();
    writeFileSync(join(tmp, 'app/src/other.css'), '@theme { --color-other: blue; }\n');
    await waitForReload();
    expect(fullReloads()).toBe(0);
    expect(await transform(TAILWIND)).toContain('"file":"src/other.css"');
  });

  it('picks up a plain CSS file edited into an entry', { timeout: 30_000 }, async () => {
    await withTailwind({ 'app/src/app.css': brand, 'app/src/extra.css': 'body { margin: 0; }\n' });
    await transform(TAILWIND);
    send.mockClear();
    writeFileSync(join(tmp, 'app/src/extra.css'), '@theme { --color-extra: blue; }\n');
    await waitForReload();
    expect(fullReloads()).toBe(0);
    expect(await transform(TAILWIND)).toContain('"file":"src/extra.css"');
  });

  it('picks up a plain CSS file edited to import an entry', { timeout: 30_000 }, async () => {
    await withTailwind({ 'app/src/tw.css': brand, 'app/src/app.css': 'body { margin: 0; }\n' });
    expect(await transform(TAILWIND)).toContain('"file":"src/tw.css"');
    send.mockClear();
    writeFileSync(join(tmp, 'app/src/app.css'), '@import "./tw.css";\n');
    await waitForReload();
    expect(fullReloads()).toBe(0);
    const list = await transform(TAILWIND);
    expect(list).toContain('"file":"src/app.css"');
    expect(list).not.toContain('"file":"src/tw.css"');
  });

  it("does not swallow the app's CSS update", { timeout: 30_000 }, async () => {
    await withTailwind({ 'app/src/app.css': brand });
    await firstSource();
    // the app imports the same file
    await transform(join(tmp, 'app/src/app.css'));
    const result = (plugin.hotUpdate as (...args: unknown[]) => unknown).call(
      { environment: server.environments.client },
      { type: 'update', file: join(tmp, 'app/src/app.css'), modules: [], timestamp: Date.now() }
    );
    // synchronously: Vite's own update of the file is not held back by the regeneration
    expect(result).toBeUndefined();
    send.mockClear();
    writeFileSync(join(tmp, 'app/src/app.css'), brand.replace('#ff3e00', '#000'));
    await waitForReload();
    await expect
      .poll(() => send.mock.calls.some(([p]: unknown[]) => (p as { type?: string })?.type === 'update'), {
        timeout: 10_000
      })
      .toBe(true);
    expect(fullReloads()).toBe(0);
  });

  it('ignores CSS changes when no Tailwind module is loaded', { timeout: 30_000 }, async () => {
    await withTailwind({ 'app/src/app.css': brand });
    send.mockClear();
    writeFileSync(join(tmp, 'app/src/app.css'), brand.replace('#ff3e00', '#000'));
    writeFileSync(join(tmp, 'app/src/other.css'), '@theme { --color-other: blue; }\n');
    await new Promise((r) => setTimeout(r, 1500));
    expect(send).not.toHaveBeenCalled();
  });

  it('serves an edit in catalog.json when the list module was never loaded', { timeout: 30_000 }, async () => {
    await withTailwind({ 'app/src/app.css': brand });
    expect(variables((await catalogJson()).data)[0]['--color-brand']).toBe('#ff3e00');
    writeFileSync(join(tmp, 'app/src/app.css'), brand.replace('#ff3e00', '#000'));
    await expect
      .poll(async () => variables((await catalogJson()).data)[0]['--color-brand'], { timeout: 10_000 })
      .toBe('#000');
    expect(send).not.toHaveBeenCalled();
  });

  describe('with a plain entry whose Tailwind files are outside the searched directories', () => {
    const entryModule = () =>
      (plugin.load as (id: string) => unknown).call({ environment: server.environments.client }, '\0' + ENTRY);
    const files = {
      'app/src/app.css': '@import "../../theme/tw.css";\n@import "../styles/tokens.css";\n',
      'theme/tw.css': '@import "tailwindcss";\n',
      'app/styles/tokens.css': '@theme { --color-acme: red; }\n'
    };

    it(
      'lists it in the entry module and regenerates on an edit, with no full-reload',
      { timeout: 30_000 },
      async () => {
        await withTailwind(files);
        expect(await entryModule()).toContain(TAILWIND);
        expect(sourceIds(await transform(TAILWIND))).toHaveLength(1);
        expect(await firstSource()).toContain('"--color-acme":"red"');
        send.mockClear();
        writeFileSync(join(tmp, 'app/styles/tokens.css'), '@theme { --color-acme: blue; }\n');
        await waitForReload();
        expect(await firstSource()).toContain('"--color-acme":"blue"');
        send.mockClear();
        writeFileSync(join(tmp, 'theme/tw.css'), '@import "tailwindcss";\n@theme { --color-far: green; }\n');
        await waitForReload();
        expect(await firstSource()).toContain('"--color-far":"green"');
        expect(fullReloads()).toBe(0);
      }
    );

    it('comes back when the file outside the root is a candidate again', { timeout: 30_000 }, async () => {
      await withTailwind({ ...files, 'app/styles/tokens.css': '', 'app/src/other.css': brand });
      expect(sourceIds(await transform(TAILWIND))).toHaveLength(2);
      writeFileSync(join(tmp, 'theme/tw.css'), 'body { margin: 0; }\n');
      await expect.poll(async () => sourceIds(await transform(TAILWIND)), { timeout: 10_000 }).toHaveLength(1);
      writeFileSync(join(tmp, 'theme/tw.css'), '@import "tailwindcss";\n');
      await expect.poll(async () => sourceIds(await transform(TAILWIND)), { timeout: 10_000 }).toHaveLength(2);
      expect(fullReloads()).toBe(0);
    });

    it("does not hold back the app's update of that file", { timeout: 30_000 }, async () => {
      await withTailwind(files);
      await transform(TAILWIND);
      const result = (plugin.hotUpdate as (...args: unknown[]) => unknown).call(
        { environment: server.environments.client },
        { type: 'update', file: join(tmp, 'theme/tw.css'), modules: [], timestamp: Date.now() }
      );
      expect(result).toBeUndefined();
    });

    it('leaves the list out of the entry module when the imports reach nothing', { timeout: 30_000 }, async () => {
      await withTailwind({
        'app/src/app.css': '@import "../styles/reset.css";\n',
        'app/styles/reset.css': 'a { b: c; }'
      });
      expect(await entryModule()).not.toContain(TAILWIND);
    });
  });

  it('reloads on a change to an imported file outside the root', { timeout: 30_000 }, async () => {
    await withTailwind({
      'app/src/app.css': '@import "tailwindcss";\n@import "../../tokens.css";\n',
      'tokens.css': '@theme { --color-outside: red; }\n'
    });
    expect(await firstSource()).toContain('"--color-outside":"red"');
    send.mockClear();
    writeFileSync(join(tmp, 'tokens.css'), '@theme { --color-outside: blue; }\n');
    await waitForReload();
    expect(fullReloads()).toBe(0);
    expect(await firstSource()).toContain('"--color-outside":"blue"');
  });
});
