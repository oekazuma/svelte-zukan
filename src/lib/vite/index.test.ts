import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { isZukanId, zukan } from './index.js';

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
  await mkdir(path.join(dir, 'zukan'));
  zukanFile = path.join(dir, 'zukan', 'Foo.zukan.svelte');
  docFile = path.join(dir, 'zukan', 'Document.md');
  await writeFile(zukanFile, source);
  await writeFile(docFile, '# Foo');
});

const transform = (code: string, id: string, ctx = { addWatchFile: vi.fn() }) =>
  plugin.transform.handler.call(ctx, code, id);

describe('isZukanId', () => {
  it('matches zukan files, with or without a query', () => {
    expect(isZukanId('/a/Foo.zukan.svelte')).toBe(true);
    expect(isZukanId('/a/Foo.zukan.svelte?v=1')).toBe(true);
  });

  it('rejects style modules, virtual modules and other files', () => {
    expect(isZukanId('/a/Foo.zukan.svelte?svelte&type=style&lang.css')).toBe(false);
    expect(isZukanId('\0/a/Foo.zukan.svelte')).toBe(false);
    expect(isZukanId('/a/Foo.svelte')).toBe(false);
  });
});

describe('transform', () => {
  it('uses a hook filter', () => {
    expect(plugin.name).toBe('vite-plugin-svelte-zukan');
    expect(plugin.enforce).toBe('pre');
    expect(plugin.transform.filter.id).toHaveProperty('include');
    expect(plugin.transform.filter.id).toHaveProperty('exclude');
  });

  it('injects doc html', () => {
    const ctx = { addWatchFile: vi.fn() };
    const result = transform(source, zukanFile, ctx);
    expect(result.code).toContain(h1);
    expect(result.map).toBeDefined();
    expect(ctx.addWatchFile).toHaveBeenCalledWith(docFile);
  });

  it('doc is null without Document.md', async () => {
    const other = await mkdtemp(path.join(tmpdir(), 'zukan-'));
    const ctx = { addWatchFile: vi.fn() };
    const result = transform(source, path.join(other, 'Foo.zukan.svelte'), ctx);
    expect(result.code).toContain('"doc":null');
    expect(ctx.addWatchFile).not.toHaveBeenCalled();
  });

  it('handler ignores non-zukan ids', () => {
    expect(transform(source, '/a/Foo.svelte')).toBeUndefined();
  });

  it('strips query from id', () => {
    const ctx = { addWatchFile: vi.fn() };
    const result = transform(source, `${zukanFile}?v=123`, ctx);
    expect(result.code).toContain(h1);
    expect(ctx.addWatchFile).toHaveBeenCalledWith(docFile);
  });
});

describe('hotUpdate', () => {
  const setup = (consumer: 'client' | 'server') => {
    const mod = { id: 'mod' };
    const ctx = {
      environment: {
        config: { consumer },
        hot: { send: vi.fn() },
        moduleGraph: {
          getModulesByFile: vi.fn(() => new Set([mod])),
          invalidateModule: vi.fn()
        }
      }
    };
    const run = (type: string, file: string, modules: unknown[] = []) =>
      plugin.hotUpdate.call(ctx, { type, file, modules, timestamp: 1 });
    return { mod, ctx, run };
  };

  it('reloads client on Document.md create', () => {
    const { mod, ctx, run } = setup('client');
    expect(run('create', docFile)).toEqual([]);
    expect(ctx.environment.moduleGraph.getModulesByFile).toHaveBeenCalledWith(zukanFile);
    expect(ctx.environment.moduleGraph.invalidateModule.mock.calls[0][0]).toBe(mod);
    expect(ctx.environment.hot.send).toHaveBeenCalledWith({ type: 'full-reload' });
  });

  it.each(['update', 'delete'])('same for %s of Document.md', (type) => {
    const { ctx, run } = setup('client');
    expect(run(type, docFile)).toEqual([]);
    expect(ctx.environment.moduleGraph.invalidateModule).toHaveBeenCalled();
    expect(ctx.environment.hot.send).toHaveBeenCalledWith({ type: 'full-reload' });
  });

  it('reloads on zukan file update', () => {
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

  it('ignores unrelated files', () => {
    const { ctx, run } = setup('client');
    expect(run('update', path.join(dir, 'zukan', 'Button.svelte'))).toBeUndefined();
    expect(ctx.environment.moduleGraph.invalidateModule).not.toHaveBeenCalled();
    expect(ctx.environment.hot.send).not.toHaveBeenCalled();
  });
});
