import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, globSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { chromium } from 'playwright';
import { normalizePath, preview } from 'vite';
import { beforeAll, expect, test } from 'vitest';

const fixtures = import.meta.dirname;
// the Windows CI job runs this file without a browser
const hasChromium = existsSync(chromium.executablePath());
const vite = join(fixtures, 'node_modules/vite/bin/vite.js');
// a production build: none of vitest's variables (ZUKAN_FROM_DIST=1 builds with the packaged library)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { NODE_ENV, VITEST, TEST, ...env } = process.env;

/** `vite build` in a child process: SvelteKit takes `process.cwd()` as its project root */
const build = (dir: string, args: string[] = []) => {
  for (const out of ['zukan-dist', 'build', 'dist', '.svelte-kit'])
    rmSync(join(dir, out), { recursive: true, force: true });
  const r = spawnSync(process.execPath, [vite, 'build', ...args], {
    cwd: dir,
    env,
    encoding: 'utf8',
    timeout: 110_000
  });
  expect(r.status, [r.error?.message, r.stderr, r.stdout?.slice(-4000)].filter(Boolean).join('\n')).toBe(0);
};

/** the IDs (and group names) missing from the built catalog; the minifier picks the quotes */
const missing = (dir: string, ids: string[]) => {
  const all = catalogJs(dir)
    .map(({ code }) => code)
    .join('\n');
  return ids.filter((id) => !['"', "'", '`'].some((q) => all.includes(q + id + q)));
};

const catalogJs = (dir: string) =>
  globSync('zukan-dist/_zukan/*.js', { cwd: dir }).map((f) => ({ f, code: readFileSync(join(dir, f), 'utf8') }));

/** text files of the catalog that contain a local absolute path */
const withLocalPaths = (dir: string) =>
  globSync('zukan-dist/**/*.{html,js,css,json}', { cwd: dir }).filter((f) => {
    const text = readFileSync(join(dir, f), 'utf8');
    return [fixtures, normalizePath(fixtures), homedir(), normalizePath(homedir())].some((p) => text.includes(p));
  });

beforeAll(() => {
  execFileSync(process.execPath, [join(fixtures, 'monorepo/setup.mjs')]);
});

test('kit monorepo build', { timeout: 120_000 }, () => {
  const dir = join(fixtures, 'monorepo/apps/catalog');
  build(dir);
  expect(existsSync(join(dir, 'build/index.html'))).toBe(true);
  expect(existsSync(join(dir, 'zukan-dist/index.html'))).toBe(true);
  // the catalog's own files only, not SvelteKit's
  expect(existsSync(join(dir, 'zukan-dist/_app'))).toBe(false);

  const js = catalogJs(dir);
  expect(js.length).toBeGreaterThan(0);
  // SvelteKit's client-only replacements must all be defined for the catalog (see the "SvelteKit runtime APIs" page in the docs)
  const leftovers = js.flatMap(({ f, code }) =>
    [...code.matchAll(/__SVELTEKIT_[A-Z_]+__/g)].map((m) => `${f}: ${m[0]}`)
  );
  expect(leftovers).toEqual([]);

  // discovered without `groups`: the workspace dependency, with same-named files told apart by their directories
  const ids = ['@fixture/ui', '@fixture/ui/lib/Card', '@fixture/ui/lib/forms/Button', '@fixture/ui/lib/nav/Button'];
  expect(missing(dir, ids)).toEqual([]);
  // the library's own catalog files are not the app's
  expect(missing(dir, ['svelte-zukan/lib/components/Badge'])).toEqual(['svelte-zukan/lib/components/Badge']);

  // sections and the rendered .md come from the catalog files themselves, not from the list
  const all = js.map(({ code }) => code).join('\n');
  for (const text of ['Long title', 'A card from']) expect(all).toContain(text);
  expect(unloadedCss(dir)).toEqual([]);
  expect(withLocalPaths(dir)).toEqual([]);
});

test('kit monorepo build under paths.base', { timeout: 180_000 }, async () => {
  const dir = join(fixtures, 'monorepo/apps/catalog');
  build(dir, ['--config', 'vite.config.base.ts']);
  const html = readFileSync(join(dir, 'zukan-dist/index.html'), 'utf8');
  // relative, so the catalog works wherever it is deployed
  expect(html).toContain('src="./_zukan/');
  const all = [html, ...catalogJs(dir).map(({ code }) => code)].join('\n');
  expect(all).not.toContain('/app/_zukan');
  expect(withLocalPaths(dir)).toEqual([]);
  if (!hasChromium) return;

  // the catalog starts in a browser, and SvelteKit's runtime APIs give the values the docs promise
  const server = await preview({
    root: dir,
    configFile: join(dir, 'vite.config.base.ts'),
    logLevel: 'error',
    preview: { port: 0 }
  });
  const browser = await chromium.launch();
  try {
    const origin = new URL(server.resolvedUrls!.local[0]).origin;
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${origin}/app/__zukan/#/preview/@fixture/ui/lib/PageInfo?section=Runtime%20API`);
    await expect.poll(() => page.locator('dd').textContent(), { timeout: 30_000 }).toBe('""');
    // a new page: a preview ignores hash changes to other routes
    const detail = await browser.newPage();
    detail.on('pageerror', (e) => errors.push(e.message));
    await detail.goto(`${origin}/app/__zukan/#/@fixture/ui/lib/Card`);
    for (const name of ['Basic', 'Long title'])
      await expect.poll(() => detail.getByRole('heading', { level: 2, name }).count(), { timeout: 30_000 }).toBe(1);
    await expect.poll(() => detail.getByText('A card from').count(), { timeout: 30_000 }).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await server.close();
  }
});

/** CSS files of the catalog that neither index.html nor any catalog JS file names */
const unloadedCss = (dir: string) => {
  const all = [
    readFileSync(join(dir, 'zukan-dist/index.html'), 'utf8'),
    ...catalogJs(dir).map(({ code }) => code)
  ].join('\n');
  return globSync('zukan-dist/_zukan/*.css', { cwd: dir }).filter((f) => !all.includes(basename(f)));
};

test('kit monorepo build with bundleStrategy inline', { timeout: 120_000 }, () => {
  const dir = join(fixtures, 'monorepo/apps/catalog');
  build(dir, ['--config', 'vite.config.inline.ts']);
  expect(globSync('zukan-dist/_zukan/*.css', { cwd: dir }).length).toBeGreaterThan(0);
  expect(unloadedCss(dir)).toEqual([]);
});

test('plain vite build', { timeout: 120_000 }, async () => {
  const dir = join(fixtures, 'vite-svelte');
  build(dir);
  expect(existsSync(join(dir, 'dist/index.html'))).toBe(true);
  expect(existsSync(join(dir, 'zukan-dist/index.html'))).toBe(true);
  expect(missing(dir, ['vite-svelte/lib/Counter'])).toEqual([]);
  expect(withLocalPaths(dir)).toEqual([]);
  // the preview's theme switches `color-scheme`, which only an unlowered `light-dark()` follows
  const css = globSync('zukan-dist/_zukan/*.css', { cwd: dir }).map((f) => readFileSync(join(dir, f), 'utf8'));
  expect(css.join('\n')).toContain('light-dark(#000');

  // the catalog as data, for tools and agents
  const data = JSON.parse(readFileSync(join(dir, 'zukan-dist/catalog.json'), 'utf8'));
  expect(data.components.map((c: { id: string }) => c.id)).toEqual(['vite-svelte/lib/Counter']);
  expect(data.components[0].sections.map((s: { title: string }) => s.title)).toContain('Basic');

  // `vite preview` serves the static catalog too
  const server = await preview({
    root: dir,
    configFile: join(dir, 'vite.config.ts'),
    logLevel: 'error',
    preview: { port: 0 }
  });
  try {
    const url = server.resolvedUrls!.local[0];
    const html = await (await fetch(`${url}__zukan/`)).text();
    const src = html.match(/src="\.\/(_zukan\/[^"]+)"/)![1];
    expect((await fetch(`${url}__zukan/${src}`)).status).toBe(200);
    const json = await fetch(`${url}__zukan/catalog.json`);
    expect(json.headers.get('content-type')).toBe('application/json');
  } finally {
    await server.close();
  }
});
