import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { discoverGroups, listCatalog } from './lib/vite/discover.js';
import { extractSections } from './lib/vite/extract.js';
import { createMatchers } from './lib/vite/matchers.js';
import { extractProps } from './lib/vite/props.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const { componentFileOf } = createMatchers('zukan');

// CI never builds the ja demo (only the Pages deploy does), so a drifted or broken copy would surface only there
function shape(group: string, dir: string) {
  const items = listCatalog(discoverGroups(root, { [group]: dir }), 'zukan');
  return Object.fromEntries(
    items.map((item) => {
      const component = componentFileOf(item.file);
      const found = existsSync(component) ? extractProps(readFileSync(component, 'utf-8'), component) : null;
      return [
        item.path,
        {
          sections: extractSections(readFileSync(item.file, 'utf-8'), item.file).length,
          props: found?.props.map((p) => p.name) ?? null
        }
      ];
    })
  );
}

describe('demo examples', () => {
  it.each([
    ['examples', 'src/examples', 'src/examples-ja'],
    ['ui', 'src/lib', 'src/ui-ja']
  ])('keeps the ja copy of %s in step', (group, en, ja) => {
    const expected = shape(group, en);
    expect(Object.keys(expected).length).toBeGreaterThan(0);
    expect(shape(group, ja)).toEqual(expected);
  });
});
