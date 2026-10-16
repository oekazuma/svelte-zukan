import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { normalizePath } from 'vite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createMatchers, escapeRegExp, zukan } from './index.js';

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
    expect(ctx.environment.hot.send).toHaveBeenCalledWith({ type: 'full-reload' });
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
    expect(ctx.environment.hot.send).toHaveBeenCalledWith({ type: 'full-reload' });
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
