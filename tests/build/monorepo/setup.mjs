// Links the workspace packages the way pnpm would. Run once before using the fixture: `node tests/build/monorepo/setup.mjs`
import { lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const here = import.meta.dirname;
const pkg = resolve(here, '../../../packages/svelte-zukan');

// `svelte-zukan` is linked but not declared in the catalog app's package.json (discovery skips it either way)
// the links point at packages/svelte-zukan: never run a link-following recursive delete on tests/build/**/node_modules
const links = [
  ['apps/catalog/node_modules/@fixture/ui', resolve(here, 'packages/ui')],
  ['apps/catalog/node_modules/svelte-zukan', pkg],
  ['packages/ui/node_modules/svelte-zukan', pkg],
  ['../vite-svelte/node_modules/svelte-zukan', pkg]
];

for (const [path, target] of links) {
  const link = resolve(here, path);
  try {
    if (lstatSync(link).isSymbolicLink()) rmSync(link);
  } catch {
    // not there yet
  }
  mkdirSync(dirname(link), { recursive: true });
  // a junction needs no admin rights on Windows; the type is ignored elsewhere
  symlinkSync(target, link, 'junction');
}
