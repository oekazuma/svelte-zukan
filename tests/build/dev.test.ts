import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, test } from 'vitest';

const fixtures = import.meta.dirname;
const dir = join(fixtures, 'vite-svelte');

let server: ViteDevServer | undefined;
let browser: Browser | undefined;

beforeAll(async () => {
  if (!existsSync(join(fixtures, '../../packages/svelte-zukan/dist/index.js')))
    throw new Error('run `pnpm run package` first: this test uses the built package');
  execFileSync(process.execPath, [join(fixtures, 'monorepo/setup.mjs')]);
  process.env.ZUKAN_FROM_DIST = '1';
  server = await createServer({
    root: dir,
    configFile: join(dir, 'vite.config.ts'),
    logLevel: 'error',
    server: { port: 0 },
    // linked packages are not prebundled by default; an npm install is. `force`: the dist changes
    // without the lockfile changing, and a cached prebundle would hide the change
    optimizeDeps: { include: ['svelte-zukan'], force: true }
  });
  await server.listen();
  browser = await chromium.launch();
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  delete process.env.ZUKAN_FROM_DIST;
});

test('a preview of the prebundled package renders only its section', { timeout: 60_000 }, async () => {
  const url = server!.resolvedUrls!.local[0];
  const page = await browser!.newPage();
  await page.goto(`${url}__zukan/#/preview/vite-svelte/lib/Counter?section=Basic`);
  await expect.poll(() => page.locator('button', { hasText: 'count:' }).count(), { timeout: 30_000 }).toBe(1);
  expect(await page.getByText('second section').count()).toBe(0);
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
