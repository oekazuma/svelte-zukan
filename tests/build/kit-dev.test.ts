import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';

const fixtures = import.meta.dirname;
const dir = join(fixtures, 'monorepo/apps/catalog');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { NODE_ENV, VITEST, TEST, ...env } = process.env;

let server: ChildProcess | undefined;
let browser: Browser | undefined;
let origin = '';

beforeAll(async () => {
  execFileSync(process.execPath, [join(fixtures, 'monorepo/setup.mjs')]);
  // a child process: SvelteKit takes `process.cwd()` as its project root
  server = spawn(process.execPath, [join(fixtures, 'node_modules/vite/bin/vite.js'), 'dev', '--port', '0'], {
    cwd: dir,
    env
  });
  let out = '';
  origin = await new Promise<string>((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      out += chunk;
      // eslint-disable-next-line no-control-regex
      const url = out.replace(/\x1b\[[\d;]*m/g, '').match(/Local:\s+(http:\/\/\S+?)\/?\s/)?.[1];
      if (url) resolve(new URL(url).origin);
    };
    server!.stdout!.on('data', onData);
    server!.stderr!.on('data', onData);
    server!.on('exit', (code) => reject(new Error(`vite dev exited with ${code}:\n${out}`)));
  });
  browser = await chromium.launch();
}, 60_000);

afterAll(async () => {
  await browser?.close();
  server?.kill();
});

test.skipIf(!existsSync(chromium.executablePath()))(
  "SvelteKit's runtime APIs give the values the docs promise in a dev preview",
  { timeout: 60_000 },
  async () => {
    const errors: string[] = [];
    const preview = async (id: string, section = 'Basic') => {
      const page = await browser!.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${origin}/__zukan/#/preview/@fixture/ui/lib/${id}?section=${encodeURIComponent(section)}`);
      return page;
    };
    // a component that fails to load shows the error in the preview, not as a page error
    const envPage = await preview('Env');
    await expect.poll(() => envPage.locator('output').textContent(), { timeout: 30_000 }).toBe('null');
    const page = await preview('PageInfo', 'Runtime API');
    await expect.poll(() => page.locator('dd').textContent(), { timeout: 30_000 }).toBe('""');
    expect(errors).toEqual([]);
  }
);
