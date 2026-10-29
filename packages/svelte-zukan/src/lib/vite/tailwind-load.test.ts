import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { normalizePath } from 'vite';
import {
  findPackage,
  findTailwindEntries,
  hasTailwind,
  loadTailwind,
  resolveTailwindNode,
  type Resolver
} from './tailwind-load.js';

const here = import.meta.dirname;
const temps: string[] = [];
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

const noResolver: Resolver = async () => undefined;

function write(file: string, content: string) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function link(name: string, root: string) {
  const target = findPackage(name, here);
  if (!target) throw new Error(`${name} is not installed`);
  const at = join(root, 'node_modules', name);
  mkdirSync(dirname(at), { recursive: true });
  symlinkSync(target, at, 'junction');
}

type Fixture = { tmp: string; root: string; src: string; entry: string };

/** `root/src/app.css` holds `css`; Tailwind is linked into `root/node_modules` unless `tailwind` is false */
function fixture(
  css: string,
  { tailwind = true, name = 'zukan-tailwind-' }: { tailwind?: boolean; name?: string } = {}
): Fixture {
  const tmp = realpathSync.native(mkdtempSync(join(tmpdir(), name)));
  temps.push(tmp);
  const root = join(tmp, 'root');
  const src = join(root, 'src');
  const entry = join(src, 'app.css');
  write(entry, css);
  if (tailwind) {
    link('tailwindcss', root);
    link('@tailwindcss/node', root);
  }
  return { tmp, root, src, entry: normalizePath(entry) };
}

/** a `@tailwindcss/node` that re-exports `names` of the installed one */
function fakeNode(root: string, names: string[]) {
  const real = join(findPackage('@tailwindcss/node', here)!, 'dist', 'index.mjs');
  const dir = join(root, 'node_modules', '@tailwindcss', 'node');
  write(
    join(dir, 'package.json'),
    JSON.stringify({ name: '@tailwindcss/node', version: '4.3.3', exports: { '.': './index.mjs' } })
  );
  write(join(dir, 'index.mjs'), `export { ${names.join(', ')} } from ${JSON.stringify(pathToFileURL(real).href)};\n`);
}

describe('findTailwindEntries', () => {
  it('finds an entry that imports tailwindcss and one with only @theme', async () => {
    const { tmp, src } = fixture('@import "tailwindcss";', { tailwind: false });
    write(join(src, 'sub/theme.css'), '@theme { --color-brand: red; }');
    write(join(src, 'sub/utils.css'), '@import "tailwindcss/utilities.css" layer(utilities);');
    expect(await findTailwindEntries([src], noResolver)).toEqual(
      [`${tmp}/root/src/app.css`, `${tmp}/root/src/sub/theme.css`, `${tmp}/root/src/sub/utils.css`].map(normalizePath)
    );
  });

  it('treats a file imported by another entry as a partial', async () => {
    const { src, entry } = fixture('@import "tailwindcss";\n@import "./theme.css";\n@import "./nested/more.css";');
    write(join(src, 'theme.css'), '@theme { --color-brand: red; }');
    write(join(src, 'nested/more.css'), '@theme { --color-more: red; }');
    expect(await findTailwindEntries([src, src], noResolver)).toEqual([entry]);
  });

  it('treats a @theme file reached through plain CSS files as a partial, and survives an import cycle', async () => {
    const { src, entry } = fixture('@import "tailwindcss";\n@import "./base.css";');
    write(join(src, 'base.css'), '@import "./more/base.css";\n@import "./base.css";');
    write(join(src, 'more/base.css'), '@import "../theme.css";\n@import "../base.css";');
    write(join(src, 'theme.css'), '@theme { --color-brand: red; }');
    expect(await findTailwindEntries([src], noResolver)).toEqual([entry]);
  });

  it('keeps a @theme file imported with url() as an entry, as Tailwind does not inline it', async () => {
    const { src, entry } = fixture('@import "tailwindcss";\n@import "./base.css";');
    write(join(src, 'base.css'), '@import url("./theme.css");');
    write(join(src, 'theme.css'), '@theme { --color-brand: red; }');
    expect(await findTailwindEntries([src], noResolver)).toEqual([entry, normalizePath(join(src, 'theme.css'))]);
  });

  it('resolves partial imports through the given resolver', async () => {
    const { src, entry } = fixture('@import "tailwindcss";\n@import "$lib/theme.css";');
    write(join(src, 'lib/theme.css'), '@theme { --color-brand: red; }');
    const resolveCss: Resolver = async (id) => (id === '$lib/theme.css' ? join(src, 'lib/theme.css') : undefined);
    expect(await findTailwindEntries([src], resolveCss)).toEqual([entry]);
  });

  it('finds partials in a directory reached through a symlink, whose imports resolve to real paths', async () => {
    const { tmp, src } = fixture('@import "tailwindcss";\n@import "./theme.css";', { tailwind: false });
    write(join(src, 'theme.css'), '@theme { --color-brand: red; }');
    const linked = join(tmp, 'linked');
    symlinkSync(src, linked, 'junction');
    // Vite's resolver follows symlinks
    const resolveCss: Resolver = async (id, base) => realpathSync(join(base, id));
    expect(await findTailwindEntries([linked], resolveCss)).toEqual([normalizePath(join(linked, 'app.css'))]);
  });

  it('lists a file reached both directly and through a symlink once, and its partial under neither path', async () => {
    const { tmp, src } = fixture('@import "tailwindcss";\n@import "./theme.css";', { tailwind: false });
    write(join(src, 'theme.css'), '@theme { --color-brand: red; }');
    const linked = join(tmp, 'linked');
    symlinkSync(src, linked, 'junction');
    const resolveCss: Resolver = async (id, base) => realpathSync(join(base, id));
    const entries = await findTailwindEntries([src, linked], resolveCss);
    expect(entries.map((file) => realpathSync(file))).toEqual([realpathSync(join(src, 'app.css'))]);
  });

  it('ignores @reference imports and unrelated CSS', async () => {
    const { src } = fixture('@reference "tailwindcss";\n.x { color: red; }');
    write(join(src, 'plain.css'), '@import "./other.css";\nbody { margin: 0; }');
    expect(await findTailwindEntries([src], noResolver)).toEqual([]);
  });

  it('keeps a @theme file that is only pulled in with @reference as an entry', async () => {
    const { src } = fixture('@reference "./theme.css";\n.x { @apply bg-brand; }');
    write(join(src, 'theme.css'), '@theme { --color-brand: red; }');
    expect(await findTailwindEntries([src], noResolver)).toEqual([normalizePath(join(src, 'theme.css'))]);
  });

  it('skips node_modules', async () => {
    const { src } = fixture('body { margin: 0; }');
    write(join(src, 'node_modules/pkg/index.css'), '@import "tailwindcss";');
    expect(await findTailwindEntries([src, join(src, 'missing')], noResolver)).toEqual([]);
  });
});

describe('unreadable CSS files', () => {
  /** a directory named `*.css`, and where symlinks are allowed, a dangling `*.css` link */
  function withUnreadable() {
    const f = fixture('@import "tailwindcss";');
    mkdirSync(join(f.src, 'dir.css'));
    try {
      symlinkSync(join(f.tmp, 'nowhere.css'), join(f.src, 'dangling.css'), 'file');
    } catch {
      // creating a file symlink needs a privilege on Windows
    }
    return f;
  }

  it('are skipped when finding entries', async () => {
    const { src, entry } = withUnreadable();
    expect(await findTailwindEntries([src], noResolver)).toEqual([entry]);
  });

  it('do not stop loadTailwind or hasTailwind', async () => {
    const { root, src } = withUnreadable();
    expect(hasTailwind([src], root)).toBe(true);
    const { sources } = await loadTailwind(root, [src]);
    expect(sources.map((s) => [s.file, s.error])).toEqual([['src/app.css', undefined]]);
  });
});

describe('resolveTailwindNode', () => {
  it('finds @tailwindcss/node and the tailwindcss it depends on', () => {
    const found = resolveTailwindNode([here]);
    expect(found?.version).toMatch(/^4\./);
    expect(normalizePath(found!.node)).toContain('@tailwindcss/node');
    expect(normalizePath(found!.tailwind)).toContain('tailwindcss');
  });

  it('finds @tailwindcss/node through @tailwindcss/vite', async () => {
    const { root, src } = fixture('@import "tailwindcss";', { tailwind: false });
    link('tailwindcss', root);
    const vite = join(root, 'node_modules', '@tailwindcss', 'vite');
    write(join(vite, 'package.json'), JSON.stringify({ name: '@tailwindcss/vite', version: '4.3.3' }));
    link('@tailwindcss/node', vite);
    const [s] = (await loadTailwind(root, [src])).sources;
    expect(s.error).toBeUndefined();
    expect(s.css).toContain('.bg-red-500');
  });
});

describe('hasTailwind', () => {
  it('needs both an entry and @tailwindcss/node', () => {
    const withTailwind = fixture('@import "tailwindcss";');
    expect(hasTailwind([withTailwind.src], withTailwind.root)).toBe(true);
    const bare = fixture('@import "tailwindcss";', { tailwind: false });
    expect(hasTailwind([bare.src], bare.root)).toBe(false);
    const noEntry = fixture('body { margin: 0; }');
    expect(hasTailwind([noEntry.src], noEntry.root)).toBe(false);
  });
});

describe('loadTailwind', () => {
  it('finds no Tailwind without @tailwindcss/node', async () => {
    const { root, src } = fixture('@import "tailwindcss";', { tailwind: false });
    expect(await loadTailwind(root, [src])).toEqual({ sources: [], watch: [] });
  });

  it('loads an entry with relative paths', async () => {
    const { root, src, entry } = fixture('@import "tailwindcss";\n@theme { --color-brand-500: #ff3e00; }');
    const {
      sources: [s],
      watch
    } = await loadTailwind(root, [src]);
    expect(s.error).toBeUndefined();
    expect(s.file).toBe('src/app.css');
    expect(s.file).not.toMatch(/^([A-Za-z]:)?\//);
    expect(s.id).toMatch(/^[0-9a-f]{12}$/);
    expect(s.version).toMatch(/^4\./);
    expect(s.prefix).toBeNull();
    expect(s.css).toContain('.bg-red-500');
    expect(s.variables['--color-brand-500']).toBe('#ff3e00');
    expect(s.categories.find((c) => c.id === 'background-color')?.tokens.map((t) => t.class)).toContain('bg-brand-500');
    expect(watch).toContain(entry);
  });

  it('adds the defaults to an @theme-only entry', async () => {
    const { root, src } = fixture('@theme { --color-brand-500: #ff3e00; }');
    const [s] = (await loadTailwind(root, [src])).sources;
    expect(s.error).toBeUndefined();
    const classes = s.categories.find((c) => c.id === 'background-color')?.tokens.map((t) => t.class);
    expect(classes).toContain('bg-brand-500');
    expect(classes).toContain('bg-red-500');
  });

  it.each(['./base.css', './base'])('adds nothing to an entry whose import %s imports tailwindcss', async (id) => {
    const theme = '@theme { --color-brand-500: #ff3e00; }';
    const single = fixture(`@import "tailwindcss";\n${theme}`);
    const split = fixture(`@import "${id}";\n${theme}`);
    write(join(split.src, 'base.css'), '@import "tailwindcss";');
    const [expected] = (await loadTailwind(single.root, [single.src])).sources;
    const [s] = (await loadTailwind(split.root, [split.src])).sources;
    expect(s.error).toBeUndefined();
    expect(s.css).toBe(expected.css);
    expect(s.categories).toEqual(expected.categories);
  });

  it('adds the utilities to the sample of an entry that imports only part of Tailwind', async () => {
    const { root, src } = fixture('@import "tailwindcss/theme.css";\n@theme { --color-brand-500: #ff3e00; }');
    const [s] = (await loadTailwind(root, [src])).sources;
    expect(s.error).toBeUndefined();
    expect(s.categories.find((c) => c.id === 'background-color')?.tokens.map((t) => t.class)).toContain('bg-brand-500');
    expect(s.css).toContain('.bg-brand-500');
  });

  it('loads a TypeScript @plugin', async () => {
    const { root, src } = fixture('@import "tailwindcss";\n@plugin "./plugin.ts";');
    write(
      join(src, 'plugin.ts'),
      `export default function (api: { addBase(base: Record<string, Record<string, string>>): void }) {
  api.addBase({ ':root': { '--from-plugin': '1' } });
}\n`
    );
    const { sources, watch } = await loadTailwind(root, [src]);
    expect(sources[0].error).toBeUndefined();
    expect(sources[0].css).toContain('--from-plugin');
    expect(watch).toContain(normalizePath(join(src, 'plugin.ts')));
  });

  it('reports a 4.0.x Tailwind as too old', async () => {
    const { root, src } = fixture('@import "tailwindcss";', { tailwind: false });
    const nm = join(root, 'node_modules');
    write(
      join(nm, 'tailwindcss/package.json'),
      JSON.stringify({ name: 'tailwindcss', version: '4.0.17', exports: { '.': './index.js' } })
    );
    write(join(nm, 'tailwindcss/index.js'), 'module.exports = {};\n');
    write(
      join(nm, '@tailwindcss/node/package.json'),
      JSON.stringify({ name: '@tailwindcss/node', version: '4.0.17', exports: { '.': './index.mjs' } })
    );
    write(join(nm, '@tailwindcss/node/index.mjs'), 'export {};\n');
    const { sources } = await loadTailwind(root, [src]);
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      file: 'src/app.css',
      version: '4.0.17',
      categories: [],
      css: '',
      error: 'Tailwind CSS 4.0.17 is older than 4.1.0, the first version svelte-zukan supports'
    });
  });

  it('watches relative imports outside the searched dirs', async () => {
    const { root, src } = fixture('@import "tailwindcss";\n@import "../tokens.css";');
    write(join(root, 'tokens.css'), '@theme { --color-outside: red; }');
    const { sources, watch } = await loadTailwind(root, [src]);
    expect(sources[0].error).toBeUndefined();
    expect(sources[0].variables['--color-outside']).toBe('red');
    expect(watch).toContain(normalizePath(join(root, 'tokens.css')));
  });

  it("reports an unsupported API as the entry's error", async () => {
    const { root, src } = fixture('@import "tailwindcss";', { tailwind: false });
    link('tailwindcss', root);
    fakeNode(root, ['loadModule', '__unstable__loadDesignSystem']);
    const [s] = (await loadTailwind(root, [src])).sources;
    expect(s.error).toMatch(/does not expose the design-system API/);
    expect(s.error).toContain(s.version);
  });

  it('keeps absolute paths out of errors', async () => {
    const { tmp, root, src } = fixture('@import "tailwindcss";\n@import "./missing.css";');
    write(join(src, 'second.css'), '@import "tailwindcss";\n@import "../../outside/tokens.css";');
    write(join(tmp, 'outside/tokens.css'), '@import "./nope.css";');
    const { sources } = await loadTailwind(root, [src]);
    expect(sources.map((s) => s.file)).toEqual(['src/app.css', 'src/second.css']);
    const [missing, outside] = sources.map((s) => s.error);
    expect(missing).toContain('./missing.css');
    expect(missing).toContain("'src'");
    expect(outside).toContain('./nope.css');
    expect(outside).toContain("'../outside'");
    for (const message of [missing, outside]) {
      for (const absolute of [tmp, normalizePath(tmp), root, normalizePath(root)])
        expect(message).not.toContain(absolute);
    }
  });

  it('removes absolute paths in both POSIX and drive-letter form from errors', async () => {
    const { root, src } = fixture('@import "tailwindcss";\n@plugin "./throws.js";');
    write(
      join(src, 'throws.js'),
      `throw new Error('failed at ' + ${JSON.stringify(root)} + '/src/a.css, C:\\\\other\\\\x.css:3:1 and D:/y/z.css.');\n`
    );
    const [s] = (await loadTailwind(root, [src])).sources;
    expect(s.error).toContain('src/a.css');
    expect(s.error).not.toContain(root);
    expect(s.error).not.toMatch(/[A-Za-z]:[\\/]/);
  });

  it('keeps paths with spaces out of errors', async () => {
    const { tmp, root, src } = fixture('@import "tailwindcss";\n@import "./missing.css";', { name: 'zukan tailwind-' });
    write(join(src, 'second.css'), '@import "tailwindcss";\n@plugin "./throws.js";');
    write(join(src, 'throws.js'), `throw new Error('failed at ' + ${JSON.stringify(root)} + '/src/a.css for good');\n`);
    const { sources } = await loadTailwind(root, [src]);
    const [missing, thrown] = sources.map((s) => s.error);
    expect(missing).toContain("from 'src'");
    expect(thrown).toContain('failed at src/a.css for good');
    for (const message of [missing, thrown]) {
      for (const leaked of [basename(tmp), 'zukan tailwind', tmp, normalizePath(tmp)])
        expect(message).not.toContain(leaked);
    }
  });

  it("reports invalid CSS as the entry's error and keeps the other entries", async () => {
    const { root, src } = fixture('@import "tailwindcss";\n.x { @apply no-such-utility; }');
    write(join(src, 'good.css'), '@import "tailwindcss";');
    const { sources } = await loadTailwind(root, [src]);
    const [bad, good] = sources;
    expect(bad.file).toBe('src/app.css');
    expect(bad.error).toMatch(/no-such-utility/);
    expect(bad).toMatchObject({ categories: [], variables: {}, css: '', prefix: null });
    expect(good.error).toBeUndefined();
    expect(good.css).toContain('.bg-red-500');
  });

  it('uses the given CSS resolver before Node resolution', async () => {
    const { root, src } = fixture('@import "tailwindcss";\n@import "$lib/x.css";');
    const x = join(root, 'elsewhere/x.css');
    write(x, '.from-alias { color: red; }');
    const calls: string[] = [];
    const css: Resolver = async (id) => {
      calls.push(id);
      return id === '$lib/x.css' ? x : undefined;
    };
    const { sources, watch } = await loadTailwind(root, [src], { css });
    expect(sources[0].error).toBeUndefined();
    expect(calls).toContain('$lib/x.css');
    expect(sources[0].css).toContain('.from-alias');
    expect(watch).toContain(normalizePath(x));
  });
});
