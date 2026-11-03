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

  it('leaves one entry when two entries import each other', async () => {
    const { src, entry } = fixture('@import "tailwindcss";\n@import "./theme.css";', { tailwind: false });
    write(join(src, 'theme.css'), '@theme { --color-brand: red; }\n@import "./app.css";');
    expect(await findTailwindEntries([src], noResolver)).toEqual([entry]);
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

  it('ignores a Tailwind import with a reference parameter, in any spelling', async () => {
    const { src } = fixture('@import "tailwindcss";', { tailwind: false });
    write(join(src, 'lib/a.css'), '@import "tailwindcss" reference; .a { @apply p-4; }');
    write(join(src, 'lib/b.css'), "@import 'tailwindcss/theme.css' reference;\n.b { @apply p-4; }");
    write(join(src, 'lib/c.css'), '@import "tailwindcss/theme.css" theme(reference); .c { @apply p-4; }');
    write(join(src, 'lib/d.css'), '@import "tailwindcss" layer(reference);');
    expect(await findTailwindEntries([src], noResolver)).toEqual([
      normalizePath(join(src, 'app.css')),
      normalizePath(join(src, 'lib/d.css'))
    ]);
  });

  it('keeps an entry that another file imports with a reference parameter', async () => {
    const { src } = fixture('@import "tailwindcss";', { tailwind: false });
    write(join(src, 'lib/c.css'), '@import "../app.css" reference;\n@theme { --color-c: red; }');
    write(join(src, 'lib/d.css'), '@import "tailwindcss/theme.css" theme(reference); @import "../app.css" reference;');
    expect(await findTailwindEntries([src], noResolver)).toEqual([
      normalizePath(join(src, 'app.css')),
      normalizePath(join(src, 'lib/c.css'))
    ]);
  });

  it('still treats a file imported with theme(reference) as a partial, since its theme is part of the entry', async () => {
    const { src } = fixture('@import "tailwindcss"; @import "./tokens.css" theme(reference);', { tailwind: false });
    write(join(src, 'tokens.css'), '@theme { --color-a: red; }');
    expect(await findTailwindEntries([src], noResolver)).toEqual([normalizePath(join(src, 'app.css'))]);
  });

  describe('a plain CSS file that imports an entry', () => {
    const aggregator = () => {
      const f = fixture('@import "./tw.css";\n@import "./tokens.css";', { tailwind: false });
      write(join(f.src, 'tw.css'), '@import "tailwindcss";');
      write(join(f.src, 'tokens.css'), '@theme { --color-brand: red; }');
      return f;
    };

    it('is the entry, and what it imports its partials', async () => {
      const { src, entry } = aggregator();
      expect(await findTailwindEntries([src], noResolver)).toEqual([entry]);
    });

    it('is the entry through other plain CSS files', async () => {
      const { src } = aggregator();
      write(join(src, 'main.css'), 'body { margin: 0; }\n@import "./mid/index.css";');
      write(join(src, 'mid/index.css'), '@import "../app.css";');
      expect(await findTailwindEntries([src], noResolver)).toEqual([normalizePath(join(src, 'main.css'))]);
    });

    it('is the entry through an alias', async () => {
      const { src, entry } = fixture('@import "$lib/tw.css";', { tailwind: false });
      write(join(src, 'lib/tw.css'), '@import "tailwindcss";');
      const resolveCss: Resolver = async (id) => (id === '$lib/tw.css' ? join(src, 'lib/tw.css') : undefined);
      expect(await findTailwindEntries([src], resolveCss)).toEqual([entry]);
    });

    it('is an entry of its own when two of them share a candidate', async () => {
      const { src, entry } = fixture('@import "./tw.css";', { tailwind: false });
      write(join(src, 'tw.css'), '@import "tailwindcss";');
      write(join(src, 'admin.css'), '@import "./tw.css";');
      expect(await findTailwindEntries([src], noResolver)).toEqual([normalizePath(join(src, 'admin.css')), entry]);
    });

    it('is a partial when an entry imports it', async () => {
      const { src, entry } = fixture('@import "tailwindcss";\n@import "./mid.css";', { tailwind: false });
      write(join(src, 'mid.css'), '@import "./tokens.css";');
      write(join(src, 'tokens.css'), '@theme { --color-brand: red; }');
      expect(await findTailwindEntries([src], noResolver)).toEqual([entry]);
    });

    it('is not an entry when it only reaches the candidate with a reference', async () => {
      const { src } = fixture('@import "./tw.css" reference;', { tailwind: false });
      const tw = normalizePath(join(src, 'tw.css'));
      write(tw, '@import "tailwindcss";');
      write(join(src, 'a.css'), '@reference "./tw.css";\n.a { @apply p-4; }');
      write(join(src, 'b.css'), '@import "./tw.css" theme(reference);\n.b { @apply p-4; }');
      write(join(src, 'c.css'), '@import "./app.css";');
      write(join(src, 'd.css'), '@import url("./tw.css");');
      expect(await findTailwindEntries([src], noResolver)).toEqual([tw]);
    });

    it('is not an entry when it is outside the searched directories', async () => {
      const { src, root } = fixture('@import "tailwindcss";', { tailwind: false });
      write(join(root, 'all.css'), '@import "./src/app.css";');
      expect(await findTailwindEntries([src], noResolver)).toEqual([normalizePath(join(src, 'app.css'))]);
    });

    it('is not an entry when Tailwind can not be loaded from it, which leaves the candidate as it was', async () => {
      const { src } = fixture('@import "./tw.css";', { tailwind: false });
      const tw = normalizePath(join(src, 'tw.css'));
      write(tw, '@import "tailwindcss";');
      expect(await findTailwindEntries([src], noResolver, (file) => file === tw)).toEqual([tw]);
    });

    describe('with the Tailwind files outside the searched directories', () => {
      const aggregator = (css: string, files: Record<string, string>, resolver = noResolver) => {
        const f = fixture(css);
        for (const [file, content] of Object.entries(files)) write(join(f.root, file), content);
        return {
          ...f,
          found: () => findTailwindEntries([f.src], resolver),
          has: () => hasTailwind([f.src], f.root, resolver)
        };
      };
      const tw = '@import "tailwindcss";\n';
      const tokens = '@theme { --color-acme: red; }\n';
      const crlfBom = (css: string) => `\uFEFF${css.replaceAll('\n', '\r\n')}`;

      it.each([
        ['basic', '@import "../styles/tw.css";\n@import "../styles/tokens.css";\n', tw, tokens],
        ['layer()', '@import "../styles/tw.css" layer(base);\n@import "../styles/tokens.css" layer(x);\n', tw, tokens],
        ['url() next to it', '@import url("./x.css");\n@import "../styles/tw.css";\n', tw, tokens],
        ['extensionless', '@import "../styles/tw";\n@import "../styles/tokens";\n', tw, tokens],
        [
          'CRLF and BOM',
          crlfBom('@import "../styles/tw.css";\n@import "../styles/tokens.css";\n'),
          crlfBom(tw),
          crlfBom(tokens)
        ]
      ])('is the entry: %s', async (_, css, twCss, tokensCss) => {
        const { entry, found, has } = aggregator(css, { 'styles/tw.css': twCss, 'styles/tokens.css': tokensCss });
        expect(await found()).toEqual([entry]);
        expect(await has()).toBe(true);
      });

      it('is the entry with a @theme file alone', async () => {
        const { entry, found, has } = aggregator('@import "../styles/tokens.css";', { 'styles/tokens.css': tokens });
        expect(await found()).toEqual([entry]);
        expect(await has()).toBe(true);
      });

      it('is the entry through plain CSS files on both sides of the search', async () => {
        const { src, found } = aggregator('@import "./mid.css";', {
          'src/mid.css': '@import "../styles/index.css";',
          'styles/index.css': '@import "./deep/tw.css";',
          'styles/deep/tw.css': tw
        });
        expect(await found()).toEqual([normalizePath(join(src, 'app.css'))]);
      });

      it.each([
        ['an alias', '$theme/tw.css', 'theme/tw.css'],
        ['a package file in node_modules', '@acme/theme/index.css', 'node_modules/@acme/theme/index.css'],
        ['a bare package name', '@acme/theme', 'node_modules/@acme/theme/index.css']
      ])('is the entry through %s', async (_, id, file) => {
        const resolver: Resolver = async (asked) => (asked === id ? join(root, file) : undefined);
        const { root, entry, found, has } = aggregator(`@import "${id}";`, { [file]: tw + tokens }, resolver);
        expect(await found()).toEqual([entry]);
        expect(await has()).toBe(true);
      });

      it('mixes with partials in the searched directories', async () => {
        const { entry, found } = aggregator('@import "../styles/tw.css";\n@import "./tokens.css";', {
          'styles/tw.css': tw,
          'src/tokens.css': tokens
        });
        expect(await found()).toEqual([entry]);
      });

      it('leaves one entry when a shadcn-svelte style app.css is the entry itself', async () => {
        const resolver: Resolver = async (id) =>
          id === 'tw-animate-css' ? join(root, 'node_modules/tw-animate-css/a.css') : undefined;
        const { root, entry, found } = aggregator(
          `${tw}@import "tw-animate-css";\n@import "../styles/tokens.css";\n@custom-variant dark (&:is(.dark *));\n`,
          { 'node_modules/tw-animate-css/a.css': '@theme inline { --animate-x: x 1s; }', 'styles/tokens.css': tokens },
          resolver
        );
        expect(await found()).toEqual([entry]);
      });

      it('stays two entries when two files share the candidate', async () => {
        const { src, entry, found } = aggregator('@import "../styles/tw.css";', {
          'styles/tw.css': tw,
          'src/admin.css': '@import "../styles/tw.css";'
        });
        expect(await found()).toEqual([normalizePath(join(src, 'admin.css')), entry]);
      });

      it('survives an import cycle', async () => {
        const { entry, found, has } = aggregator('@import "../styles/a.css";', {
          'styles/a.css': '@import "./b.css";\n@import "./a.css";',
          'styles/b.css': `@import "./a.css";\n@import "../src/app.css";\n${tokens}`
        });
        expect(await found()).toEqual([entry]);
        expect(await has()).toBe(true);
      });

      it('makes no entry from a cycle that reaches nothing', async () => {
        const { found, has } = aggregator('@import "../styles/a.css";', {
          'styles/a.css': '@import "./b.css";',
          'styles/b.css': '@import "./a.css";'
        });
        expect(await found()).toEqual([]);
        expect(await has()).toBe(false);
      });

      it('survives a missing import next to the candidate', async () => {
        const { entry, found } = aggregator('@import "../styles/gone.css";\n@import "../styles/tw.css";', {
          'styles/tw.css': `@import "./gone-too.css";\n${tw}`
        });
        expect(await found()).toEqual([entry]);
      });

      it('makes no entry from a missing import, or from a resolver that fails', async () => {
        const failing: Resolver = async () => {
          throw new Error('boom');
        };
        const { found, has } = aggregator(
          '@import "../styles/gone.css";\n@import "@acme/theme/index.css";',
          {},
          failing
        );
        expect(await found()).toEqual([]);
        expect(await has()).toBe(false);
      });

      it('makes no entry from plain CSS, in or out of node_modules', async () => {
        const resolver: Resolver = async (id) =>
          id === 'normalize.css' ? join(root, 'node_modules/normalize.css/normalize.css') : undefined;
        const { root, src, found, has } = aggregator(
          '@import "../styles/reset.css";\n@import "normalize.css";',
          {
            'styles/reset.css': '@layer theme { body { margin: 0; } }',
            'node_modules/normalize.css/normalize.css': '/* @theme { --color-x: red; } */ html { margin: 0; }'
          },
          resolver
        );
        expect(await found()).toEqual([]);
        expect(await has()).toBe(false);
        expect((await loadTailwind(root, [src], { css: resolver })).sources).toEqual([]);
      });

      it('makes no entry through a reference', async () => {
        const { found, has } = aggregator(
          [
            '@import "../styles/tw.css" reference;',
            '@reference "../styles/tw.css";',
            '@import "../styles/tw.css" theme(reference);',
            '@import url("../styles/tw.css");'
          ].join('\n'),
          { 'styles/tw.css': tw }
        );
        expect(await found()).toEqual([]);
        expect(await has()).toBe(false);
      });

      it('resolves nothing without Tailwind', async () => {
        const { root, src } = fixture('@import "@acme/theme/index.css";', { tailwind: false });
        const asked: string[] = [];
        const spy: Resolver = async (id) => void asked.push(id);
        expect(await hasTailwind([src], root, spy)).toBe(false);
        expect((await loadTailwind(root, [src], { css: spy })).sources).toEqual([]);
        expect(asked).toEqual([]);
      });

      it('gets the tokens of those files, and watches them', async () => {
        const { root, src, entry } = aggregator('@import "../styles/tw.css";\n@import "../styles/tokens.css";', {
          'styles/tw.css': tw,
          'styles/tokens.css': tokens
        });
        const { sources, watch } = await loadTailwind(root, [src]);
        expect(sources.map((s) => [s.file, s.error])).toEqual([['src/app.css', undefined]]);
        expect(sources[0].variables['--color-acme']).toBe('red');
        expect(sources[0].css).toContain('.bg-acme');
        expect(watch).toEqual(
          expect.arrayContaining([entry, ...['tw', 'tokens'].map((n) => normalizePath(join(root, `styles/${n}.css`)))])
        );
      });

      it('watches what the search read while it reaches no candidate', async () => {
        const { root, src } = aggregator('@import "../styles/tw.css";\n@import "../styles/gone.css";', {
          'styles/tw.css': 'body { margin: 0; }'
        });
        const { sources, watch } = await loadTailwind(root, [src]);
        expect(sources).toEqual([]);
        expect(watch).toEqual([normalizePath(join(root, 'styles/tw.css'))]);
      });
    });

    it('leaves one entry in an import cycle', async () => {
      const { src, entry } = fixture('@import "./other.css";\n@import "./tokens.css";', { tailwind: false });
      write(join(src, 'other.css'), '@import "./app.css";');
      write(join(src, 'tokens.css'), '@theme { --color-brand: red; }');
      expect(await findTailwindEntries([src], noResolver)).toEqual([entry]);
    });

    it('makes no entry without a candidate', async () => {
      const { src } = fixture('@import "./reset.css";');
      write(join(src, 'reset.css'), 'body { margin: 0; }');
      expect(await findTailwindEntries([src], noResolver)).toEqual([]);
      expect(await hasTailwind([src], dirname(src))).toBe(false);
    });

    it('gets the tokens of everything it imports', async () => {
      const { root, src } = fixture('@import "./tw.css";\n@import "./tokens.css";');
      write(join(src, 'tw.css'), '@import "tailwindcss";');
      write(join(src, 'tokens.css'), '@theme { --color-brand: red; }');
      const { sources } = await loadTailwind(root, [src]);
      expect(sources.map((s) => [s.file, s.error])).toEqual([['src/app.css', undefined]]);
      expect(sources[0].variables['--color-brand']).toBe('red');
      expect(sources[0].css).toContain('.bg-brand');
    });
  });

  it('matches the .css extension by case on every platform', async () => {
    const { src } = fixture('body { margin: 0; }');
    write(join(src, 'Theme.CSS'), '@theme { --color-brand: red; }');
    expect(await findTailwindEntries([src], noResolver)).toEqual([]);
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
    expect(await hasTailwind([src], root)).toBe(true);
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
  it('needs both an entry and @tailwindcss/node', async () => {
    const withTailwind = fixture('@import "tailwindcss";');
    expect(await hasTailwind([withTailwind.src], withTailwind.root)).toBe(true);
    const bare = fixture('@import "tailwindcss";', { tailwind: false });
    expect(await hasTailwind([bare.src], bare.root)).toBe(false);
    const noEntry = fixture('body { margin: 0; }');
    expect(await hasTailwind([noEntry.src], noEntry.root)).toBe(false);
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

  it('resolves theme values written with Tailwind CSS functions', async () => {
    const { root, src } = fixture(
      '@import "tailwindcss";\n@theme { --spacing-gutter: --spacing(6); --radius-card: theme(--radius-lg); }'
    );
    const [s] = (await loadTailwind(root, [src])).sources;
    expect(s.error).toBeUndefined();
    const value = (id: string, cls: string) =>
      s.categories.find((c) => c.id === id)?.tokens.find((t) => t.class === cls)?.value;
    expect(value('padding', 'p-gutter')).toBe('calc(0.25rem * 6)');
    expect(value('border-radius', 'rounded-card')).toBe('0.5rem');
    expect(s.variables['--spacing-gutter']).toBe('calc(var(--spacing) * 6)');
    expect(s.css).toContain('.p-gutter');
  });

  const theme = '@theme { --spacing-gutter: --spacing(6); }';
  it.each([
    `@import "tailwindcss" layer(tw); ${theme}`,
    `@import "tailwindcss/theme.css"; ${theme}`,
    `@import "tailwindcss/theme.css" layer(tokens); ${theme}`,
    '@import "./tokens.css"; @import "tailwindcss";'
  ])('shows what Tailwind writes in Full config for the theme of %s', async (css) => {
    const { root, src } = fixture(css);
    write(join(src, 'tokens.css'), theme);
    const [source] = (await loadTailwind(root, [src])).sources;
    expect(source.error).toBeUndefined();
    expect(source.variables['--spacing-gutter']).toBe('calc(var(--spacing) * 6)');
  });

  it.each([':root', ':root, :host'])(
    "keeps the declared theme value in Full config under the entry's own %s",
    async (selector) => {
      const { root, src } = fixture(
        `@import "tailwindcss"; @theme { --color-brand: #f00; } ${selector} { --color-brand: #00f; }`
      );
      const [source] = (await loadTailwind(root, [src])).sources;
      expect(source.variables['--color-brand']).toBe('#f00');
      const tokens = source.categories.find((c) => c.id === 'background-color')!.tokens;
      expect(tokens.find((t) => t.class === 'bg-brand')?.value).toBe('#00f');
    }
  );

  it('adds Tailwind to the sample of an entry whose only Tailwind import is a reference', async () => {
    const { root, src } = fixture('@import "tailwindcss" reference; @theme { --color-brand: #f00; }');
    const [source] = (await loadTailwind(root, [src])).sources;
    expect(source.error).toBeUndefined();
    expect(source.css).toContain('.bg-brand');
  });

  it('keeps an external @import in front of the style rules of the sample', async () => {
    const url = '@import url("https://fonts.example.com/css2?family=Inter")';
    for (const css of [
      `@import "tailwindcss"; ${url}; @theme { --font-a: Inter; }`,
      `${url}; @theme { --font-a: Inter; }`
    ]) {
      const { root, src } = fixture(css);
      const [source] = (await loadTailwind(root, [src])).sources;
      expect(source.error, css).toBeUndefined();
      const at = source.css.indexOf(url);
      expect(source.css.indexOf('@layer theme, base, components, utilities;'), css).toBeLessThan(at);
      expect(at, css).toBeLessThan(source.css.indexOf('@layer theme {'));
      expect(source.css.split(url)).toHaveLength(2);
      expect(source.categories.find((c) => c.id === 'font-family')?.tokens.map((t) => t.class)).toContain('font-a');
    }
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
    const { sources } = await loadTailwind(split.root, [split.src]);
    expect(sources).toHaveLength(1);
    const [s] = sources;
    expect(s.error).toBeUndefined();
    expect(s.css).toBe(expected.css);
    expect(s.categories).toEqual(expected.categories);
  });

  it('still adds tailwindcss to an entry whose import imports it only with url()', async () => {
    const { root, src } = fixture('@import "./base.css";\n@theme { --color-brand-500: #ff3e00; }');
    write(join(src, 'base.css'), '@import url("tailwindcss");');
    const [s] = (await loadTailwind(root, [src])).sources;
    expect(s.error).toBeUndefined();
    expect(s.css).toContain('.bg-brand-500');
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

  it.each(['@plugin', '@config'])('watches a %s file that throws', async (rule) => {
    const { root, src } = fixture(`@import "tailwindcss";\n${rule} "../plugins/brand.js";`);
    write(join(root, 'plugins/brand.js'), 'throw new Error("boom");\n');
    const { sources, watch } = await loadTailwind(root, [src]);
    expect(sources[0].error).toContain('boom');
    expect(watch).toContain(normalizePath(join(root, 'plugins/brand.js')));
  });

  it('watches an extensionless relative @plugin that throws as the file Tailwind loads', async () => {
    const { root, src } = fixture('@import "tailwindcss";\n@plugin "./plugin";');
    write(join(src, 'plugin.ts'), 'throw new Error("boom");\n');
    const { sources, watch } = await loadTailwind(root, [src]);
    expect(sources[0].error).toContain('boom');
    expect(watch).toContain(normalizePath(join(src, 'plugin.ts')));
    expect(watch).not.toContain(normalizePath(join(src, 'plugin')));
  });

  it('watches an aliased @plugin whose function throws', async () => {
    const { root, src } = fixture('@import "tailwindcss";\n@plugin "$lib/plugin.mjs";');
    const file = join(root, 'elsewhere/plugin.mjs');
    write(file, 'export default function () {\n  throw new Error("boom");\n}\n');
    const js: Resolver = async (id) => (id === '$lib/plugin.mjs' ? file : undefined);
    const { sources, watch } = await loadTailwind(root, [src], { js });
    expect(sources[0].error).toContain('boom');
    expect(watch).toContain(normalizePath(file));
  });

  it('keeps the theme values of a @config file, but not those Tailwind registers by itself', async () => {
    const { root, src } = fixture('@import "tailwindcss";\n@config "../tailwind.config.mjs";');
    write(
      join(root, 'tailwind.config.mjs'),
      "export default { theme: { extend: { screens: { tablet: '700px' }, borderRadius: { DEFAULT: '0.5rem' } } } };\n"
    );
    const [s] = (await loadTailwind(root, [src])).sources;
    expect(s.error).toBeUndefined();
    expect(s.variables['--breakpoint-tablet']).toBe('700px');
    expect(s.variables['--radius']).toBe('0.5rem');
    expect(s.variables).not.toHaveProperty('--blur');
    expect(s.categories.find((c) => c.id === 'breakpoints')?.tokens.map((t) => t.cssVariable)).toContain(
      '--breakpoint-tablet'
    );
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
