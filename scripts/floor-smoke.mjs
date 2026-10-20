// Installs the packed svelte-zukan into a fresh project, the way a user does, and checks it on the
// Node version this script runs on: `vite build` writes the catalog, and a dev server serves /__zukan/.
// CI runs it on the floor of `engines.node`; the dev toolchain is never held to that floor.
//
//   node scripts/floor-smoke.mjs <path to svelte-zukan-*.tgz>
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(import.meta.dirname, '..');
const tarball = process.argv[2] && resolve(process.argv[2]);
if (!tarball || !existsSync(tarball)) {
  console.error(
    'usage: node scripts/floor-smoke.mjs <path to svelte-zukan-*.tgz> (from `npm pack` after `pnpm run package`)'
  );
  process.exit(1);
}

const floor = JSON.parse(readFileSync(join(root, 'packages/svelte-zukan/package.json'), 'utf8')).engines.node;
console.log(`floor-smoke: node ${process.versions.node}, engines.node ${floor}`);

// the versions the repository is tested with, not whatever is newest in the peer ranges
const lock = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8');
const locked = (name) => {
  const key = name.startsWith('@') ? `'${name}'` : name;
  const m = lock.match(new RegExp(`\\n {4}${key.replace(/[/.]/g, '\\$&')}:\\n {6}specifier: .+\\n {6}version: (\\S+)`));
  assert.ok(m, `${name} is not in the lockfile's catalog`);
  return m[1];
};

const files = {
  'package.json': JSON.stringify({
    name: 'floor-app',
    private: true,
    type: 'module',
    devDependencies: {
      'svelte-zukan': `file:${tarball}`,
      vite: locked('vite'),
      svelte: locked('svelte'),
      '@sveltejs/vite-plugin-svelte': locked('@sveltejs/vite-plugin-svelte')
    }
  }),
  'vite.config.js': `import { svelte } from '@sveltejs/vite-plugin-svelte';
import { zukan } from 'svelte-zukan/vite';
import { defineConfig } from 'vite';

export default defineConfig({ plugins: [zukan({ build: true }), svelte()] });
`,
  'index.html': '<!doctype html><script type="module" src="/src/main.js"></script>',
  'src/main.js': `import { mount } from 'svelte';
import Hello from './lib/Hello.svelte';

mount(Hello, { target: document.body });
`,
  'src/lib/Hello.svelte': `<script>
  let { name = 'floor' } = $props();
</script>

<p class="hello">Hello {name}</p>

<style>
  .hello {
    color: rebeccapurple;
  }
</style>
`,
  'src/lib/Hello.zukan.svelte': `<script>
  import { Section } from 'svelte-zukan';
  import Hello from './Hello.svelte';
</script>

<Section title="Basic"><Hello /></Section>
<Section title="Named"><Hello name="zukan" /></Section>
`,
  'src/lib/Hello.zukan.md': 'A greeting.\n'
};

const dir = mkdtempSync(join(tmpdir(), 'zukan-floor-'));
let server;
try {
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), text);
  }
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: dir, stdio: 'inherit' });

  execFileSync(process.execPath, [join(dir, 'node_modules/vite/bin/vite.js'), 'build', '--logLevel', 'warn'], {
    cwd: dir,
    stdio: 'inherit'
  });
  assert.ok(existsSync(join(dir, 'zukan-dist/index.html')), 'vite build did not write zukan-dist/index.html');
  const built = globSync('zukan-dist/_zukan/*.js', { cwd: dir })
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n');
  for (const text of ['floor-app/lib/Hello', 'Named', 'A greeting.'])
    assert.ok(built.includes(text), `the built catalog does not contain ${JSON.stringify(text)}`);
  console.log('floor-smoke: vite build wrote the catalog');

  const { createServer } = await import(pathToFileURL(join(dir, 'node_modules/vite/dist/node/index.js')).href);
  server = await createServer({ root: dir, logLevel: 'error', server: { port: 0 } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  const page = await fetch(`${url}__zukan/`);
  assert.equal(page.status, 200, '/__zukan/ did not answer 200');
  assert.ok((await page.text()).includes('virtual:svelte-zukan/entry'), '/__zukan/ is not the catalog page');
  const list = await (await fetch(`${url}@id/__x00__virtual:svelte-zukan/catalog`)).text();
  assert.ok(list.includes('floor-app/lib/Hello'), 'the dev catalog does not list Hello');
  console.log('floor-smoke: the dev server serves the catalog');
} finally {
  await server?.close();
  rmSync(dir, { recursive: true, force: true });
}
