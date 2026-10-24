import { cpSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { chromium, type Browser } from 'playwright';
import { createLogger, createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, test } from 'vitest';

const fixtures = import.meta.dirname;
const pkg = join(fixtures, '../../packages/svelte-zukan');

let app: string | undefined;
let server: ViteDevServer | undefined;
let browser: Browser | undefined;
const logged: string[] = [];

beforeAll(async () => {
  if (!existsSync(join(pkg, 'dist/index.js')))
    throw new Error('run `pnpm run package` first: this test uses the built package');
  // the vite-svelte fixture with the package installed as npm installs it: copied into node_modules, not linked,
  // so that the plugin finds itself installed. Its dependencies and the app's are linked
  app = realpathSync(mkdtempSync(join(tmpdir(), 'zukan-dev-')));
  for (const file of ['index.html', 'package.json', 'src'])
    cpSync(join(fixtures, 'vite-svelte', file), join(app, file), { recursive: true });
  const installed = join(app, 'node_modules/svelte-zukan');
  mkdirSync(installed, { recursive: true });
  for (const file of ['package.json', 'dist']) cpSync(join(pkg, file), join(installed, file), { recursive: true });
  symlinkSync(join(pkg, 'node_modules'), join(installed, 'node_modules'), 'junction');
  symlinkSync(join(fixtures, 'node_modules/svelte'), join(app, 'node_modules/svelte'), 'junction');

  const { zukan } = await import(pathToFileURL(join(installed, 'dist/vite/index.js')).href);
  const logger = createLogger('error');
  logger.info = (message) => void logged.push(message);
  server = await createServer({
    root: app,
    configFile: false,
    customLogger: logger,
    server: { port: 0 },
    plugins: [zukan({ build: true }), svelte()]
  });
  await server.listen();
  browser = await chromium.launch();
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  // node_modules holds links into the repository: remove them before the recursive delete
  if (app) {
    for (const link of ['node_modules/svelte', 'node_modules/svelte-zukan/node_modules']) rmSync(join(app, link));
    rmSync(app, { recursive: true, force: true });
  }
});

test('the installed package is prebundled before the first visit', () => {
  expect(server!.config.optimizeDeps.include).toContain('svelte-zukan');
});

test('a preview of the prebundled package renders only its section', { timeout: 60_000 }, async () => {
  const url = server!.resolvedUrls!.local[0];
  const page = await browser!.newPage();
  await page.goto(`${url}__zukan/#/preview/vite-svelte/lib/Counter?section=Basic`);
  await expect.poll(() => page.locator('button', { hasText: 'count:' }).count(), { timeout: 30_000 }).toBe(1);
  expect(await page.getByText('second section').count()).toBe(0);
  // found only on the first visit, it would be optimized then and the page reloaded
  expect(logged.join('\n')).not.toMatch(/optimized: .*svelte-zukan/);
});

test('the accessibility check runs the real axe-core in a preview', { timeout: 60_000 }, async () => {
  const url = server!.resolvedUrls!.local[0];
  const page = await browser!.newPage();
  await page.goto(`${url}__zukan/#/vite-svelte/lib/Counter`);
  const check = page.getByRole('button', { name: 'Check accessibility' }).first();
  await expect.poll(() => check.isEnabled(), { timeout: 30_000 }).toBe(true);
  await check.click();
  await expect
    .poll(() => page.getByText(/^(No accessibility issues found|Accessibility issues \(\d+\))$/).count(), {
      timeout: 30_000
    })
    .toBe(1);
});

test('WebMCP tools list the catalog and run axe-core on a section', { timeout: 60_000 }, async () => {
  const url = server!.resolvedUrls!.local[0];
  const page = await browser!.newPage();
  // a stand-in for a browser that implements WebMCP: it keeps what the page provides
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'modelContext', {
      value: {
        provideContext: (ctx: { tools: unknown[] }) => ((window as unknown as { tools: unknown[] }).tools = ctx.tools)
      }
    });
  });
  await page.goto(`${url}__zukan/`);
  await page.waitForFunction(() => (window as unknown as { tools?: unknown[] }).tools?.length);
  const call = (name: string, input: object) =>
    page.evaluate(
      async ([name, input]) => {
        const tools = (window as unknown as { tools: { name: string; execute: (i: object) => Promise<unknown> }[] })
          .tools;
        return tools.find((t) => t.name === name)!.execute(input as object);
      },
      [name, input] as const
    ) as Promise<{ content: { text: string }[]; isError?: boolean }>;
  const list = JSON.parse((await call('list_components', {})).content[0].text);
  expect(list.components.map((c: { id: string }) => c.id)).toEqual(['vite-svelte/lib/Counter']);
  const checked = await call('check_accessibility', { id: 'vite-svelte/lib/Counter', section: 'Basic' });
  expect(checked.isError).toBeUndefined();
  const result = JSON.parse(checked.content[0].text);
  expect(Array.isArray(result.violations) && Array.isArray(result.review)).toBe(true);
});
