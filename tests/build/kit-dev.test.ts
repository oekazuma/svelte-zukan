import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';

const fixtures = import.meta.dirname;
const dir = join(fixtures, 'monorepo/apps/catalog');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { NODE_ENV, VITEST, TEST, ...env } = process.env;

let browser: Browser | undefined;
const hasChromium = existsSync(chromium.executablePath());

/** `vite dev` in a child process, as SvelteKit takes `process.cwd()` as its project root; resolves to its origin */
const dev = (server: { process?: ChildProcess }, args: string[] = [], extraEnv: Record<string, string> = {}) => {
  const child = spawn(
    process.execPath,
    [join(fixtures, 'node_modules/vite/bin/vite.js'), 'dev', '--port', '0', ...args],
    {
      cwd: dir,
      env: { ...env, ...extraEnv }
    }
  );
  server.process = child;
  let out = '';
  return new Promise<string>((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      out += chunk;
      // eslint-disable-next-line no-control-regex
      const url = out.replace(/\x1b\[[\d;]*m/g, '').match(/Local:\s+(http:\/\/\S+?)\/?\s/)?.[1];
      if (url) resolve(new URL(url).origin);
    };
    child.stdout!.on('data', onData);
    child.stderr!.on('data', onData);
    child.on('exit', (code) => reject(new Error(`vite dev exited with ${code}:\n${out}`)));
  });
};

beforeAll(async () => {
  execFileSync(process.execPath, [join(fixtures, 'monorepo/setup.mjs')]);
  browser = await chromium.launch();
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

test.skipIf(!hasChromium)(
  "SvelteKit's runtime APIs give the values the docs promise in a dev preview",
  { timeout: 90_000 },
  async () => {
    const server: { process?: ChildProcess } = {};
    try {
      const origin = await dev(server);
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
    } finally {
      server.process?.kill();
    }
  }
);

test.skipIf(!hasChromium).each([
  ['in the assets directory', 'static/logo.svg', ''],
  ['in the assets directory, under paths.base', 'static/logo.svg', '/app'],
  ['outside the assets directory', 'src/lib/logo.svg', '']
])('a logo %s shows in the dev catalog', { timeout: 90_000 }, async (_, logo, base) => {
  const server: { process?: ChildProcess } = {};
  const source = readFileSync(join(dir, logo), 'utf8');
  try {
    const origin = await dev(server, ['--config', 'vite.config.logo.ts'], {
      FIXTURE_LOGO: logo,
      ...(base && { FIXTURE_BASE: '1' })
    });
    const page = await browser!.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`${origin}${base}/__zukan/`);
    const img = page.locator('a.logo img');
    await expect.poll(() => img.count(), { timeout: 30_000 }).toBe(1);
    const width = () => img.evaluate((el: HTMLImageElement) => el.naturalWidth);
    await expect.poll(width, { timeout: 30_000 }).toBe(24);
    expect(errors).toEqual([]);

    // an edit reloads the catalog, not the app's tab
    const app = await browser!.newPage();
    await app.goto(`${origin}${base}/`);
    await app.evaluate(() => ((window as unknown as { kept: boolean }).kept = true));
    writeFileSync(join(dir, logo), source.replaceAll('24', '32'));
    await expect.poll(width, { timeout: 30_000 }).toBe(32);
    expect(await app.evaluate(() => (window as unknown as { kept?: boolean }).kept)).toBe(true);
  } finally {
    writeFileSync(join(dir, logo), source);
    server.process?.kill();
  }
});
