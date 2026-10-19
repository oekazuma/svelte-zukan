import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, globSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, expect, test } from 'vitest';

const fixtures = import.meta.dirname;
const vite = join(fixtures, '../node_modules/vite/bin/vite.js');
// a production build from the repo's source: none of vitest's variables, and not the dist
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { NODE_ENV, VITEST, TEST, ZUKAN_FROM_DIST, ...env } = process.env;

/** `vite build` in a child process: SvelteKit takes `process.cwd()` as its project root */
const build = (dir: string) => {
  for (const out of ['zukan-dist', 'build', 'dist', '.svelte-kit'])
    rmSync(join(dir, out), { recursive: true, force: true });
  const r = spawnSync(process.execPath, [vite, 'build'], { cwd: dir, env, encoding: 'utf8', timeout: 110_000 });
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
  // SvelteKit's client-only replacements must all be defined for the catalog (see the spec's "SvelteKit の実行時 API")
  const leftovers = js.flatMap(({ f, code }) =>
    [...code.matchAll(/__SVELTEKIT_[A-Z_]+__/g)].map((m) => `${f}: ${m[0]}`)
  );
  expect(leftovers).toEqual([]);

  // discovered without `groups`: the workspace dependency, with same-named files told apart by their directories
  const ids = ['@fixture/ui', '@fixture/ui/lib/Card', '@fixture/ui/lib/forms/Button', '@fixture/ui/lib/nav/Button'];
  expect(missing(dir, ids)).toEqual([]);
});

test('plain vite build', { timeout: 120_000 }, () => {
  const dir = join(fixtures, 'vite-svelte');
  build(dir);
  expect(existsSync(join(dir, 'dist/index.html'))).toBe(true);
  expect(existsSync(join(dir, 'zukan-dist/index.html'))).toBe(true);
  expect(missing(dir, ['vite-svelte/lib/Counter'])).toEqual([]);
});
