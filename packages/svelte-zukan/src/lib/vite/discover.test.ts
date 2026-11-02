import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizePath } from 'vite';
import { discoverGroups, listCatalog, listUncataloged } from './discover.js';

let tmp: string;
beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), 'zukan-discover-')));
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

const write = (rel: string, content = '') => {
  const file = join(tmp, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
};
const pkg = (dir: string, json: object) => write(`${dir}/package.json`, JSON.stringify(json));
const p = (rel: string) => normalizePath(join(tmp, rel));
const names = (groups: { name: string }[]) => groups.map((g) => g.name);
const paths = (root: string, suffix = 'zukan') => listCatalog(discoverGroups(root), suffix).map((i) => i.path);

describe('discoverGroups', () => {
  it('single package', () => {
    pkg('app', { name: 'app' });
    write('app/src/a.zukan.svelte');
    expect(discoverGroups(join(tmp, 'app'))).toEqual([{ name: 'app', dirs: [p('app/src')] }]);
  });

  it('falls back to the directory name without a package name', () => {
    write('app/src/a.zukan.svelte');
    expect(names(discoverGroups(join(tmp, 'app')))).toEqual(['app']);
  });

  it('workspace dependency', () => {
    pkg('app', { name: 'app', dependencies: { '@acme/ui': 'workspace:*' } });
    pkg('ui', { name: '@acme/ui' });
    write('app/src/a.zukan.svelte');
    write('ui/src/b.zukan.svelte');
    mkdirSync(join(tmp, 'app/node_modules/@acme'), { recursive: true });
    symlinkSync(join(tmp, 'ui'), join(tmp, 'app/node_modules/@acme/ui'), 'dir');
    expect(discoverGroups(join(tmp, 'app'))).toEqual([
      { name: 'app', dirs: [p('app/src')] },
      { name: '@acme/ui', dirs: [p('ui/src')] }
    ]);
  });

  it('workspace dependency linked at the workspace root (npm, yarn, bun)', () => {
    pkg('', { name: 'root', private: true, workspaces: ['app', 'ui'] });
    pkg('app', { name: 'app', dependencies: { '@acme/ui': '*' } });
    pkg('ui', { name: '@acme/ui' });
    write('app/src/a.zukan.svelte');
    write('ui/src/b.zukan.svelte');
    mkdirSync(join(tmp, 'node_modules/@acme'), { recursive: true });
    symlinkSync(join(tmp, 'ui'), join(tmp, 'node_modules/@acme/ui'), 'dir');
    expect(discoverGroups(join(tmp, 'app'))).toEqual([
      { name: 'app', dirs: [p('app/src')] },
      { name: '@acme/ui', dirs: [p('ui/src')] }
    ]);
  });

  it('a hoisted installed package at the workspace root is skipped', () => {
    pkg('', { name: 'root', private: true, workspaces: ['app'] });
    pkg('app', { name: 'app', dependencies: { lodash: '^4' } });
    write('app/src/a.zukan.svelte');
    pkg('node_modules/lodash', { name: 'lodash' });
    write('node_modules/lodash/src/x.zukan.svelte');
    expect(names(discoverGroups(join(tmp, 'app')))).toEqual(['app']);
  });

  it("the app's own link wins over the workspace root", () => {
    pkg('', { name: 'root', private: true, workspaces: ['app', 'ui', 'ui2'] });
    pkg('app', { name: 'app', dependencies: { '@acme/ui': '*' } });
    pkg('ui', { name: '@acme/ui' });
    pkg('ui2', { name: '@acme/ui' });
    write('app/src/a.zukan.svelte');
    write('ui/src/b.zukan.svelte');
    write('ui2/src/c.zukan.svelte');
    mkdirSync(join(tmp, 'app/node_modules/@acme'), { recursive: true });
    mkdirSync(join(tmp, 'node_modules/@acme'), { recursive: true });
    symlinkSync(join(tmp, 'ui'), join(tmp, 'app/node_modules/@acme/ui'), 'dir');
    symlinkSync(join(tmp, 'ui2'), join(tmp, 'node_modules/@acme/ui'), 'dir');
    expect(discoverGroups(join(tmp, 'app'))).toEqual([
      { name: 'app', dirs: [p('app/src')] },
      { name: '@acme/ui', dirs: [p('ui/src')] }
    ]);
  });

  it('no workspace root: nothing changes', () => {
    pkg('app', { name: 'app', dependencies: { '@acme/ui': '*' } });
    pkg('ui', { name: '@acme/ui' });
    write('app/src/a.zukan.svelte');
    write('ui/src/b.zukan.svelte');
    mkdirSync(join(tmp, 'node_modules/@acme'), { recursive: true });
    symlinkSync(join(tmp, 'ui'), join(tmp, 'node_modules/@acme/ui'), 'dir');
    expect(names(discoverGroups(join(tmp, 'app')))).toEqual(['app']);
  });

  it('skips installed packages', () => {
    pkg('app', { name: 'app', dependencies: { lodash: '^4' } });
    write('app/src/a.zukan.svelte');
    pkg('app/node_modules/lodash', { name: 'lodash' });
    write('app/node_modules/lodash/src/x.zukan.svelte');
    expect(names(discoverGroups(join(tmp, 'app')))).toEqual(['app']);
  });

  it('skips pnpm-style links into node_modules', () => {
    pkg('app', { name: 'app', dependencies: { foo: '1' } });
    write('app/src/a.zukan.svelte');
    pkg('app/node_modules/.pnpm/foo@1/node_modules/foo', { name: 'foo' });
    write('app/node_modules/.pnpm/foo@1/node_modules/foo/src/x.zukan.svelte');
    symlinkSync(join(tmp, 'app/node_modules/.pnpm/foo@1/node_modules/foo'), join(tmp, 'app/node_modules/foo'), 'dir');
    expect(names(discoverGroups(join(tmp, 'app')))).toEqual(['app']);
  });

  it('skips a workspace link to svelte-zukan itself', () => {
    pkg('app', { name: 'app', devDependencies: { 'svelte-zukan': 'workspace:*' } });
    write('app/src/a.zukan.svelte');
    pkg('zukan', { name: 'svelte-zukan' });
    write('zukan/src/lib/Badge.zukan.svelte');
    mkdirSync(join(tmp, 'app/node_modules'), { recursive: true });
    symlinkSync(join(tmp, 'zukan'), join(tmp, 'app/node_modules/svelte-zukan'), 'dir');
    expect(names(discoverGroups(join(tmp, 'app')))).toEqual(['app']);
  });

  it('dependencies before devDependencies', () => {
    pkg('app', { name: 'app', devDependencies: { dev: 'workspace:*' }, dependencies: { dep: 'workspace:*' } });
    for (const n of ['dep', 'dev']) {
      pkg(n, { name: n });
      write(`${n}/src/a.zukan.svelte`);
      mkdirSync(join(tmp, 'app/node_modules'), { recursive: true });
      symlinkSync(join(tmp, n), join(tmp, 'app/node_modules', n), 'dir');
    }
    write('app/src/a.zukan.svelte');
    expect(names(discoverGroups(join(tmp, 'app')))).toEqual(['app', 'dep', 'dev']);
  });

  it('scans a directory once even when several links point to it', () => {
    pkg('app', { name: 'app', dependencies: { ui: 'workspace:*', 'ui-alias': 'workspace:*', self: 'link:.' } });
    pkg('ui', { name: 'ui' });
    write('app/src/a.zukan.svelte');
    write('ui/src/b.zukan.svelte');
    mkdirSync(join(tmp, 'app/node_modules'), { recursive: true });
    symlinkSync(join(tmp, 'ui'), join(tmp, 'app/node_modules/ui'), 'dir');
    symlinkSync(join(tmp, 'ui'), join(tmp, 'app/node_modules/ui-alias'), 'dir');
    symlinkSync(join(tmp, 'app'), join(tmp, 'app/node_modules/self'), 'dir');
    expect(names(discoverGroups(join(tmp, 'app')))).toEqual(['app', 'ui']);
    expect(paths(join(tmp, 'app'))).toEqual(['app/a', 'ui/b']);
    expect(discoverGroups(join(tmp, 'app'), { x: ['src', './src/'] })).toEqual([{ name: 'x', dirs: [p('app/src')] }]);
  });

  it('names the package.json that fails to parse', () => {
    write('app/package.json', '{ nope');
    expect(() => discoverGroups(join(tmp, 'app'))).toThrow(p('app/package.json'));
  });

  it('groups option', () => {
    pkg('app', { name: 'app', dependencies: { x: 'workspace:*' } });
    write('app/src/a.zukan.svelte');
    write('app/z/a.zukan.svelte');
    write('app/b/a.zukan.svelte');
    expect(discoverGroups(join(tmp, 'app'), { z: 'z', b: ['b', 'src'] })).toEqual([
      { name: 'z', dirs: [p('app/z')] },
      { name: 'b', dirs: [p('app/b'), p('app/src')] }
    ]);
  });

  it('missing groups dir throws', () => {
    mkdirSync(join(tmp, 'app'));
    expect(() => discoverGroups(join(tmp, 'app'), { ui: 'nope' })).toThrow(/"ui".*nope/);
  });

  // macOS and Windows find the directory under either case, but the watcher reports only the one on disk
  it('a groups dir written in another case than on disk throws on every platform', () => {
    write('app/src/lib/Card.zukan.svelte');
    write('ui/src/Card.zukan.svelte');
    const caseInsensitive = existsSync(join(tmp, 'APP'));
    for (const dir of ['src/Lib', 'SRC/lib', '../UI/src'])
      expect(() => discoverGroups(join(tmp, 'app'), { ui: dir })).toThrow(
        caseInsensitive ? `"ui" is written "${dir}", but is "${dir.toLowerCase()}" on disk` : /directory not found/
      );
  });

  // macOS opens a decomposed name by its composed spelling; Linux and Windows find neither by the other
  it('a groups dir is matched by case, not by Unicode normalization', () => {
    const [nfc, nfd] = ['Café', 'Café'.normalize('NFD')];
    write(`app/src/${nfd}/Card.zukan.svelte`);
    const app = join(tmp, 'app');
    const either = existsSync(join(app, 'src', nfc));
    if (either)
      expect(discoverGroups(app, { ui: `src/${nfc}` })).toEqual([{ name: 'ui', dirs: [p(`app/src/${nfc}`)] }]);
    else expect(() => discoverGroups(app, { ui: `src/${nfc}` })).toThrow(/directory not found/);
    const upper = nfc.toUpperCase();
    expect(() => discoverGroups(app, { ui: `src/${upper}` })).toThrow(
      existsSync(join(app, 'src', upper))
        ? `is written "src/${upper}", but is "src/${nfd}" on disk`
        : 'directory not found'
    );
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'a groups dir under a parent that can not be listed is taken as written',
    () => {
      write('app/src/lib/Card.zukan.svelte');
      const src = join(tmp, 'app/src');
      chmodSync(src, 0o111);
      try {
        expect(discoverGroups(join(tmp, 'app'), { ui: 'src/lib' })).toEqual([{ name: 'ui', dirs: [p('app/src/lib')] }]);
      } finally {
        chmodSync(src, 0o755);
      }
    }
  );

  it('a groups dir reached through a link or by an absolute path is not taken for one in another case', () => {
    write('ui/src/Card.zukan.svelte');
    mkdirSync(join(tmp, 'app/node_modules'), { recursive: true });
    symlinkSync(join(tmp, 'ui'), join(tmp, 'app/node_modules/Linked'), 'junction');
    expect(discoverGroups(join(tmp, 'app'), { a: 'node_modules/Linked/src', b: join(tmp, 'ui/src') })).toEqual([
      { name: 'a', dirs: [p('app/node_modules/Linked/src')] },
      { name: 'b', dirs: [p('ui/src')] }
    ]);
  });

  it('reserved group names throw', () => {
    mkdirSync(join(tmp, 'app'));
    expect(() => discoverGroups(tmp, { preview: 'app' })).toThrow(/"preview"/);
    expect(() => discoverGroups(tmp, { 'preview/x': 'app' })).toThrow(/"preview\/x"/);
    // only a prefix of the whole name is reserved
    expect(discoverGroups(tmp, { previews: 'app', 'x/preview': 'app' })).toHaveLength(2);
  });

  it('a workspace dependency named preview is reserved only once it has a catalog file', () => {
    pkg('app', { name: 'app', dependencies: { preview: 'workspace:*' } });
    pkg('preview', { name: 'preview' });
    mkdirSync(join(tmp, 'app/node_modules'), { recursive: true });
    symlinkSync(join(tmp, 'preview'), join(tmp, 'app/node_modules/preview'), 'dir');
    write('app/src/a.zukan.svelte');
    write('preview/src/X.svelte');
    expect(paths(join(tmp, 'app'))).toEqual(['app/a']);
    write('preview/src/X.zukan.svelte');
    expect(() => paths(join(tmp, 'app'))).toThrow(/group name "preview" is reserved/);
  });

  it('an empty group name or directory list throws', () => {
    mkdirSync(join(tmp, 'app'));
    for (const name of ['', ' '])
      expect(() => discoverGroups(tmp, { [name]: 'app' })).toThrow(
        'svelte-zukan: a group name in `groups` must not be empty'
      );
    expect(() => discoverGroups(tmp, { ui: [] })).toThrow(
      'svelte-zukan: group "ui" in `groups` needs at least one directory'
    );
  });
});

describe('listCatalog IDs', () => {
  it('same name in different dirs', () => {
    pkg('app', { name: 'app' });
    write('app/src/lib/forms/Button.zukan.svelte');
    write('app/src/lib/nav/Button.zukan.svelte');
    const items = listCatalog(discoverGroups(join(tmp, 'app')), 'zukan');
    expect(items).toEqual([
      {
        group: 'app',
        name: 'Button',
        dir: 'lib/forms',
        path: 'app/lib/forms/Button',
        file: p('app/src/lib/forms/Button.zukan.svelte')
      },
      {
        group: 'app',
        name: 'Button',
        dir: 'lib/nav',
        path: 'app/lib/nav/Button',
        file: p('app/src/lib/nav/Button.zukan.svelte')
      }
    ]);
  });

  it('collapses Dir/Dir', () => {
    pkg('app', { name: 'app' });
    write('app/src/lib/Button/Button.zukan.svelte');
    expect(listCatalog(discoverGroups(join(tmp, 'app')), 'zukan')).toMatchObject([
      { name: 'Button', dir: 'lib', path: 'app/lib/Button' }
    ]);
  });

  it('groups option is relative to the given dir', () => {
    write('app/src/lib/Card.zukan.svelte');
    const items = listCatalog(discoverGroups(join(tmp, 'app'), { ui: 'src/lib' }), 'zukan');
    expect(items).toMatchObject([{ group: 'ui', name: 'Card', dir: '', path: 'ui/Card' }]);
  });

  it('root file has empty dir', () => {
    pkg('app', { name: 'app' });
    write('app/src/Top.zukan.svelte');
    write('app/src/Top/Top.zukan.svelte'.replace('Top/Top', 'Same/Same'));
    const items = listCatalog(discoverGroups(join(tmp, 'app')), 'zukan');
    expect(items.map((i) => [i.path, i.dir])).toEqual([
      ['app/Same', ''],
      ['app/Top', '']
    ]);
  });

  it('stable when files are added', () => {
    pkg('app', { name: 'app' });
    write('app/src/lib/forms/Button.zukan.svelte');
    const before = paths(join(tmp, 'app'));
    write('app/src/lib/nav/Button.zukan.svelte');
    write('app/src/Button.zukan.svelte');
    const after = paths(join(tmp, 'app'));
    expect(after).toEqual(expect.arrayContaining(before));
    expect(after).toHaveLength(3);
  });

  it('suffix: catalog', () => {
    pkg('app', { name: 'app' });
    write('app/src/A.catalog.svelte');
    write('app/src/B.zukan.svelte');
    expect(paths(join(tmp, 'app'), 'catalog')).toEqual(['app/A']);
  });

  it('scoped group name', () => {
    pkg('app', { name: '@acme/ui' });
    write('app/src/lib/Card.zukan.svelte');
    expect(paths(join(tmp, 'app'))).toEqual(['@acme/ui/lib/Card']);
  });

  // glob metacharacters in the directory's own path
  it.each(['app', 'g (x) [y]', 'g {a,b}'])('skips node_modules inside a searched dir (in %s)', (app) => {
    write(`${app}/ui/Foo.zukan.svelte`);
    write(`${app}/ui/node_modules/x/Foo.zukan.svelte`);
    write(`${app}/ui/a/node_modules/y/Bar.zukan.svelte`);
    const items = listCatalog(discoverGroups(join(tmp, app), { ui: 'ui' }), 'zukan');
    expect(items.map((i) => i.path)).toEqual(['ui/Foo']);
  });

  it('skips a directory named like a catalog file', () => {
    write('app/src/x.zukan.svelte/inner.txt');
    write('app/src/Real.zukan.svelte');
    expect(listCatalog(discoverGroups(join(tmp, 'app'), { g: 'src' }), 'zukan').map((i) => i.path)).toEqual(['g/Real']);
  });

  it('rel may contain preview', () => {
    write('app/ui/preview/Foo.zukan.svelte');
    const items = listCatalog(discoverGroups(join(tmp, 'app'), { ui: 'ui' }), 'zukan');
    expect(items.map((i) => i.path)).toEqual(['ui/preview/Foo']);
  });
});

describe('listCatalog order', () => {
  it('orders by group, then collator, then code point', () => {
    for (const f of ['Button', 'alert', 'Item10', 'Item2', 'a']) write(`app/ui/${f}.zukan.svelte`);
    // a case-insensitive file system cannot hold `a` and `A` side by side, so put them in two directories
    write('app/ui2/A.zukan.svelte');
    write('app/other/z.zukan.svelte');
    const items = listCatalog(discoverGroups(join(tmp, 'app'), { ui: ['ui', 'ui2'], other: 'other' }), 'zukan');
    expect(items.map((i) => i.path)).toEqual([
      'ui/A',
      'ui/a',
      'ui/alert',
      'ui/Button',
      'ui/Item2',
      'ui/Item10',
      'other/z'
    ]);
  });
});

describe('listCatalog errors', () => {
  it('duplicate after collapsing', () => {
    write('app/ui/Button.zukan.svelte');
    write('app/ui/Button/Button.zukan.svelte');
    const groups = discoverGroups(join(tmp, 'app'), { ui: 'ui' });
    expect(() => listCatalog(groups, 'zukan')).toThrow(
      new RegExp(`ui/Button[\\s\\S]*${p('app/ui/Button').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
    );
  });

  it('duplicate across groups', () => {
    write('app/a/ui/Card.zukan.svelte');
    write('app/b/Card.zukan.svelte');
    const groups = discoverGroups(join(tmp, 'app'), { '@acme': 'a', '@acme/ui': 'b' });
    expect(() => listCatalog(groups, 'zukan')).toThrow(/@acme\/ui\/Card[\s\S]*a\/ui\/Card[\s\S]*b\/Card/);
  });
});

describe('listCatalog empties', () => {
  it('group without files is dropped', () => {
    write('app/a/X.zukan.svelte');
    write('app/b/readme.md');
    const items = listCatalog(discoverGroups(join(tmp, 'app'), { a: 'a', b: 'b' }), 'zukan');
    expect(new Set(items.map((i) => i.group))).toEqual(new Set(['a']));
  });

  it('no files at all', () => {
    pkg('app', { name: 'app' });
    write('app/src/x.svelte');
    expect(paths(join(tmp, 'app'))).toEqual([]);
  });
});

// globSync ignores case on macOS and Windows only
it('matches file names by case on every platform', () => {
  pkg('app', { name: 'app' });
  write('app/src/A.Zukan.svelte');
  write('app/src/b.zukan.svelte');
  write('app/src/C.SVELTE');
  const groups = discoverGroups(join(tmp, 'app'));
  expect(listCatalog(groups, 'zukan').map((i) => i.path)).toEqual(['app/b']);
  expect(listUncataloged(groups, 'zukan', new Set())).toEqual([{ group: 'app', file: p('app/src/A.Zukan.svelte') }]);
});

describe('listUncataloged', () => {
  it.each(['app', 'g (x) [y]'])('lists the .svelte files that have no catalog file next to them (in %s)', (app) => {
    pkg(app, { name: 'app' });
    write(`${app}/src/lib/Button/Button.svelte`);
    write(`${app}/src/lib/Button/Button.zukan.svelte`, '<Section title="A"><p>a</p></Section>');
    write(`${app}/src/lib/Card.svelte`);
    write(`${app}/src/lib/forms/Input.svelte`);
    write(`${app}/src/lib/Card.test.svelte`);
    write(`${app}/src/lib/Card.stories.svelte`);
    write(`${app}/src/lib/Card.story.svelte`);
    write(`${app}/src/routes/+page.svelte`);
    write(`${app}/src/routes/Header.svelte`);
    write(`${app}/src/lib/node_modules/x/X.svelte`);
    const groups = discoverGroups(join(tmp, app));
    const cataloged = new Set([p(`${app}/src/lib/Button/Button.svelte`)]);
    expect(listUncataloged(groups, 'zukan', cataloged)).toEqual([
      { group: 'app', file: p(`${app}/src/lib/Card.svelte`) },
      { group: 'app', file: p(`${app}/src/lib/forms/Input.svelte`) }
    ]);
  });

  it('skips a directory named like a .svelte file', () => {
    write('app/src/lib/dir.svelte/inner.txt');
    write('app/src/lib/Card.svelte');
    expect(listUncataloged(discoverGroups(join(tmp, 'app'), { g: 'src/lib' }), 'zukan', new Set())).toEqual([
      { group: 'g', file: p('app/src/lib/Card.svelte') }
    ]);
  });

  it('keeps routes/ when the scanned directory is not src, and follows the suffix', () => {
    pkg('app', { name: 'app' });
    write('app/ui/routes/Tab.svelte');
    write('app/ui/Tab.catalog.svelte');
    const groups = discoverGroups(join(tmp, 'app'), { ui: 'ui' });
    expect(listUncataloged(groups, 'catalog', new Set())).toEqual([
      { group: 'ui', file: p('app/ui/routes/Tab.svelte') }
    ]);
  });
});
