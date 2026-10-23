import { once } from 'node:events';
import { mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createServer, type InlineConfig, type Plugin, type ViteDevServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zukan } from './index.js';
import { findPackage } from './tailwind-load.js';
import { TAILWIND, TAILWIND_SOURCE, metaId } from './virtual.js';

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
    plugins: [plugin],
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

it('changing an imported props type updates the metadata', { timeout: 25_000 }, async () => {
  await server.close();
  const types = join(tmp, 'app/src/types.ts');
  writeFileSync(types, 'export type Props = { a: number };\n');
  writeFileSync(
    join(tmp, 'app/src/A.svelte'),
    '<script lang="ts">\n  import type { Props } from \'./types\';\n  let { a }: Props = $props();\n</script>\n<p>{a}</p>'
  );
  await start();
  expect(await meta('app/A')).toContain('"name":"a","type":"number"');
  send.mockClear();
  writeFileSync(types, 'export type Props = { a: number; /** new */ b?: string };\n');
  await waitForReload();
  expect(fullReloads()).toBe(0);
  expect(await meta('app/A')).toContain('"name":"b","type":"string"');
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
