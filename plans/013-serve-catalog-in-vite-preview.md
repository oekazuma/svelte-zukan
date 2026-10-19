# Plan 013: `vite preview` serves the static catalog at `/__zukan/`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 30b6d25..HEAD -- packages/svelte-zukan/src/lib/vite/index.ts packages/svelte-zukan/src/lib/vite/index.test.ts tests/build/build.test.ts docs/content/guides/static-export.md docs/content/ja/guides/static-export.md`
> Earlier plans change other parts of `index.ts`, `index.test.ts` and `build.test.ts` (hotUpdate, metadata module, fs.allow, new build assertions). Those are expected. STOP if `configureServer` or the `build` option handling differs from "Current state".

## Status

- Priority: P3
- Effort: M
- Risk: LOW
- Depends on: run after 007 and 008 (same files); after 005 for `build.test.ts`
- Category: direction (feature)
- Planned at: commit `30b6d25`, 2026-10-19

## Why this matters

The dev server has `/__zukan/`, but `vite preview`, the usual way to check a production build locally, has nothing there. With `build: true`, the catalog is written to its own directory (`zukan-dist/` by default, apart from the app's output), so users publishing it (for example to GitHub Pages) cannot check the exported catalog with their normal `vite build && vite preview`. Serving that directory at `<base>__zukan/` in the preview server closes the gap without a new option, which fits the project's "keep the option set small" rule (AGENTS.md).

## Current state

- `packages/svelte-zukan/src/lib/vite/index.ts`:
  - `config` hook (`order: 'post'`) sets `resolved = resolveOptions(root, options)`. `resolved.build` is the absolute, normalized catalog outDir, or `false` when `build` is off. The hook runs for `vite preview` too;
  - `configureServer(server)` adds a middleware directly (not in a returned hook) so that it runs before SvelteKit's. It redirects `${base}__zukan` to `${base}__zukan/` with a 302, keeping the query, and serves the HTML at `${base}__zukan/`. It also wraps `server.printUrls` to print `  ➜  zukan:   ${local}__zukan/`:
    ```ts
    const printUrls = server.printUrls;
    server.printUrls = () => {
      printUrls();
      const local = server.resolvedUrls?.local[0];
      if (local) logger.info(`  ➜  zukan:   ${local}__zukan/`);
    };
    ```
  - `isInside(dir, parent)` (exported from `options.ts`) checks path containment on normalized paths.
- The static output (from `buildApp`): `<outDir>/index.html` and `<outDir>/_zukan/*` (`.js`, `.css` and assets). URLs in it are relative (`./_zukan/...`), so it works under any path.
- Tests:
  - `src/lib/vite/index.test.ts`, `describe('configureServer')` defines a `request(mw, url)` helper and uses `fakeServer(root, base)` (module scope) with `boot(root, options)`;
  - `tests/build/build.test.ts`, test `'plain vite build'`, builds `tests/build/vite-svelte` (plain Vite, `zukan({ build: true })`) and checks `zukan-dist/index.html`.
- Docs: `docs/content/guides/static-export.md` and `docs/content/ja/guides/static-export.md`, bullet list after the first paragraph.
- Conventions: plugin messages in English; no new dependencies (AGENTS.md: "No new dependencies for small things"). Do not use `sirv` or other packages: Vite does not export its own static server.

## Commands you will need

| Purpose           | Command                                                                                  | Expected on success |
| ----------------- | ---------------------------------------------------------------------------------------- | ------------------- |
| Install           | `pnpm install`                                                                           | exit 0              |
| Plugin tests      | `pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/index.test.ts` | all pass            |
| Build tests       | `pnpm --filter build-tests exec vitest run build.test.ts`                                | all pass            |
| All library tests | `pnpm --filter svelte-zukan exec vitest run`                                             | all pass            |
| Typecheck / lint  | `pnpm run package && pnpm run check && pnpm run format && pnpm run lint`                 | exit 0              |
| Docs              | `pnpm --filter docs build`                                                               | exit 0              |

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/vite/index.ts` (a new `configurePreviewServer` hook)
- `packages/svelte-zukan/src/lib/vite/index.test.ts` (a new describe; moving `request` to module scope is fine)
- `tests/build/build.test.ts` (one assertion block in `'plain vite build'`)
- `docs/content/guides/static-export.md`, `docs/content/ja/guides/static-export.md`
- `.changeset/preview-catalog.md` (create)

**Out of scope**: building the catalog during `vite preview`, a new option, and changes to `configureServer`.

## Git workflow

- Branch: `advisor/013-serve-catalog-in-vite-preview`
- Commits, for example `feat: serve the static catalog at /__zukan/ in vite preview`.
- Do NOT push or open a PR unless the operator told you to.

## Steps

### Step 1: Unit tests first

In `index.test.ts`, move the `request` helper out of `describe('configureServer')` to module scope, let the fake request carry a method (`mw({ url, method: 'GET' }, res, next)`), and make `end` store the body as a string: `end(body?: string | Buffer) { resolve({ ...out, ...(this.statusCode !== 200 && { status: this.statusCode }), body: body?.toString() }); }`. The preview middleware sends Buffers (it must, for binary assets), and `toContain` on a Buffer compares bytes. Add `describe('configurePreviewServer')`:

- setup: `makeApp()`, then create `<root>/zukan-dist/index.html` (`<html>catalog</html>`) and `<root>/zukan-dist/_zukan/zukan-abc.js` (`export {}`). `boot(root, { build: true })`, then `p.configurePreviewServer(server)` with `server = fakeServer(root)`, and take `mw = server.middlewares.use.mock.calls[0][0]`;
- `'serves index.html and the files under _zukan/'`: `/__zukan/` → body contains `catalog`, type matches `/^text\/html/`; `/__zukan/_zukan/zukan-abc.js` → type matches `/javascript/`;
- `'redirects /__zukan to /__zukan/'` (status 302, location `/__zukan/`);
- `'leaves other URLs and missing files to the next middleware'`: `/`, `/__zukanx`, `/__zukan/nope.js` → `{ status: 'next' }`;
- `'does not serve files outside the catalog directory'`: `/__zukan/..%2Fpackage.json` and `/__zukan/%2e%2e/package.json` → `{ status: 'next' }`;
- `'follows base'`: `fakeServer(root, '/app/')` serves `/app/__zukan/` and passes `/__zukan/` on;
- `'does nothing without build'`: `boot(root)` (no `build`), `p.configurePreviewServer(server)`, and `server.middlewares.use` is not called.

**Verify**: these tests fail (the hook does not exist yet).

### Step 2: Implement `configurePreviewServer`

Add next to `configureServer`:

```ts
    configurePreviewServer(server) {
      const out = resolved.build;
      if (!out) return;
      const { base } = server.config;
      const prefix = `${base}__zukan/`;
      // called directly (not in a returned hook) to run before SvelteKit's preview middleware
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        const url = req.url ?? '';
        const path = url.split(/[?#]/)[0];
        if (path === `${base}__zukan`) {
          res.statusCode = 302;
          res.setHeader('location', `${prefix}${url.slice(path.length)}`);
          return res.end();
        }
        if (!path.startsWith(prefix)) return next();
        let rel: string;
        try {
          rel = decodeURIComponent(path.slice(prefix.length)) || 'index.html';
        } catch {
          return next();
        }
        const file = normalizePath(resolve(out, rel));
        if (!isInside(file, out) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('content-type', CONTENT_TYPES[extname(file)] ?? 'application/octet-stream');
        res.end(readFileSync(file));
      });
      const printUrls = server.printUrls;
      server.printUrls = () => {
        printUrls();
        const local = server.resolvedUrls?.local[0];
        if (local) server.config.logger.info(`  ➜  zukan:   ${local}__zukan/`);
      };
    },
```

with a module-level map covering what the build writes:

```ts
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json'
};
```

Import `statSync` and `extname` alongside the existing `node:fs` / `node:path` imports. Then factor the two identical `printUrls` wrappers (this one and the one in `configureServer`) into one local function used by both hooks. Keep `readFileSync(file)` without an encoding: binary assets must stay bytes.

**Verify**: plugin tests → all pass.

### Step 3: End-to-end check in the build test

In `tests/build/build.test.ts`, at the end of `'plain vite build'`, after the build:

```ts
// `vite preview` serves the static catalog too
const server = await preview({
  root: dir,
  configFile: join(dir, 'vite.config.ts'),
  logLevel: 'error',
  preview: { port: 0 }
});
try {
  const url = server.resolvedUrls!.local[0];
  const html = await (await fetch(`${url}__zukan/`)).text();
  const src = html.match(/src="\.\/(_zukan\/[^"]+)"/)![1];
  expect((await fetch(`${url}__zukan/${src}`)).status).toBe(200);
} finally {
  await server.close();
}
```

`preview` comes from `vite`. The test function must become `async`. `preview()` runs in the Vitest process and reads its environment, so it follows whatever `ZUKAN_FROM_DIST` CI sets for the run; do not set it in the test.

**Verify**: `pnpm --filter build-tests exec vitest run build.test.ts` → all pass.

### Step 3b: Check SvelteKit's preview by hand

Run `pnpm run package && pnpm --filter example build`, then start `pnpm --filter example preview` in the background.

**Verify**: `curl -s http://localhost:4173/__zukan/ | grep -c '_zukan/'` → at least `1` (the catalog, not SvelteKit's 404 page). Stop the preview server.

### Step 4: Docs and changeset

1. `docs/content/guides/static-export.md`, add a bullet to the list after the second paragraph: "`vite preview` serves the exported catalog at `/__zukan/` (under `base` when it is set), so you can check it before you deploy it". JA: 「`vite preview` でも、書き出したカタログを `/__zukan/`（`base` を設定していればその下）で開けます。公開する前に確かめられます」.
2. Create `.changeset/preview-catalog.md`:
   ```md
   ---
   'svelte-zukan': minor
   ---

   feat: with `build: true`, `vite preview` serves the exported catalog at `/__zukan/`.
   ```

**Verify**: `pnpm run format && pnpm run lint` → exit 0, and `pnpm --filter docs build` → exit 0.

## Test plan

Six unit tests (Step 1) and one end-to-end preview check (Step 3). The path-escape cases in Step 1 are the security-relevant ones.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run` exits 0
- [ ] `pnpm --filter build-tests exec vitest run build.test.ts` exits 0
- [ ] `pnpm run package && pnpm run check` and `pnpm run lint` exit 0
- [ ] `pnpm --filter docs build` exits 0
- [ ] `.changeset/preview-catalog.md` exists
- [ ] `git diff --name-only $(git merge-base main HEAD)..HEAD` together with `git status --short` lists only in-scope files and `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

- With SvelteKit (`pnpm run package && pnpm --filter example build && pnpm --filter example preview`), `/__zukan/` is answered by SvelteKit's preview (a 404 page from Kit) instead of the catalog. The middleware order assumption is wrong; report it.
- `preview()` with `port: 0` gives a `resolvedUrls` with port 0 or null. Report rather than hard-coding a port.
- A path-escape test passes only after weakening `isInside`.

## Maintenance notes

- If the build starts writing new asset types into `_zukan/`, add them to `CONTENT_TYPES`; unknown types are served as `application/octet-stream`, which browsers refuse for module scripts.
- Vite's `preview()` skips its "directory does not exist. Did you build your project?" check when any plugin defines `configurePreviewServer`, so with this hook that hint no longer appears for users who run `vite preview` before building.
- The preview server serves whatever is in the catalog outDir, which may be shared with other files (`build: { outDir }`). That is intended: it is the user's own build output.
