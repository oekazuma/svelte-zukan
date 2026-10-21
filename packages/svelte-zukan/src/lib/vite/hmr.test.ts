import { once } from 'node:events';
import { realpathSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { zukan } from './index.js';
import { metaId } from './virtual.js';

let tmp: string;
let server: ViteDevServer;
let send: ReturnType<typeof vi.spyOn>;

async function start(options: Parameters<typeof zukan>[0] = {}) {
  server = await createServer({
    root: join(tmp, 'app'),
    configFile: false,
    logLevel: 'silent',
    plugins: [zukan(options)],
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
  // realpath: on macOS the tmpdir is a symlink and the watcher reports resolved paths
  tmp = realpathSync(await mkdtemp(join(tmpdir(), 'zukan-hmr-')));
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
