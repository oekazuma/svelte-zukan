// Links the workspace packages the way pnpm would. Run once before using the fixture: `node fixtures/monorepo/setup.mjs`
import { lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const here = import.meta.dirname;
const repo = resolve(here, '../..');

// `svelte-zukan` is linked but not declared in the catalog app's package.json:
// declared, the link would look like a workspace package and the repo's own `src` would be scanned as a group
const links = [
  ['apps/catalog/node_modules/@fixture/ui', resolve(here, 'packages/ui')],
  ['apps/catalog/node_modules/svelte-zukan', repo],
  ['packages/ui/node_modules/svelte-zukan', repo],
  ['../vite-svelte/node_modules/svelte-zukan', repo]
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
