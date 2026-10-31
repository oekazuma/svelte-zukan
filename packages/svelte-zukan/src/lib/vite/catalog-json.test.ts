import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { catalogJson } from './catalog-json.js';

it('gives a catalog file outside the root an error without an absolute path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zukan-catalog-json-'));
  const root = join(dir, 'apps/app');
  const ui = join(dir, 'packages/ui/src');
  mkdirSync(root, { recursive: true });
  mkdirSync(ui, { recursive: true });
  const file = join(ui, 'B.zukan.svelte');
  writeFileSync(file, '<Section>x</Section>\n');
  const { components } = catalogJson({
    root,
    title: 't',
    items: [{ group: 'ui', name: 'B', dir: '', path: 'ui/B', file }],
    uncataloged: [],
    docFileOf: (f) => f.replace('.svelte', '.md'),
    componentFileOf: (f) => f.replace('.zukan', ''),
    tailwind: []
  });
  expect(components[0].error).toBe('../../packages/ui/src/B.zukan.svelte:1 <Section> needs a title');
});

it('gives a catalog file that can not be read an error without an absolute path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zukan-catalog-json-'));
  const root = join(dir, 'apps/app');
  const file = join(dir, 'packages/ui/src/Gone.zukan.svelte');
  const { components } = catalogJson({
    root,
    title: 't',
    items: [{ group: 'ui', name: 'Gone', dir: '', path: 'ui/Gone', file }],
    uncataloged: [],
    docFileOf: (f) => f.replace('.svelte', '.md'),
    componentFileOf: (f) => f.replace('.zukan', ''),
    tailwind: []
  });
  expect(components[0].error).toContain('../../packages/ui/src/Gone.zukan.svelte');
  expect(components[0].error).not.toContain(dir);
});

it('gives the .md without a byte order mark or CRLF', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zukan-catalog-json-'));
  const file = join(dir, 'A.zukan.svelte');
  writeFileSync(file, '<Section title="a">x</Section>\n');
  writeFileSync(join(dir, 'A.zukan.md'), '\uFEFF# A\r\n\r\ntext');
  const { components } = catalogJson({
    root: dir,
    title: 't',
    items: [{ group: 'ui', name: 'A', dir: '', path: 'ui/A', file }],
    uncataloged: [],
    docFileOf: (f) => f.replace('.svelte', '.md'),
    componentFileOf: (f) => f.replace('.zukan', ''),
    tailwind: []
  });
  expect(components[0].doc).toBe('# A\n\ntext');
});
