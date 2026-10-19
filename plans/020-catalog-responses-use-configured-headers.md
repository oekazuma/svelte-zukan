# Plan 020: The catalog's own responses carry the headers configured in `server.headers` and `preview.headers`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- packages/svelte-zukan/src/lib/vite/index.ts packages/svelte-zukan/src/lib/vite/index.test.ts`
> Plans 015 and 019 are expected to have changed these files (`configEnvironment`, `buildApp`, `load`, `hotUpdate`, the `build` and `metadata modules` tests). Any change to `configureServer`, `configurePreviewServer`, `fakeServer` or `request` in the test file is a STOP condition.

## Status

- Priority: P2
- Effort: S
- Risk: LOW
- Depends on: plans/019-opaque-meta-ids-and-lookup-cache.md (same files; run after it)
- Category: security
- Planned at: commit `293f5a4`, 2026-10-20

## Why this matters

The plugin answers two kinds of requests itself, before Vite's own middlewares: the catalog HTML at `/__zukan/` on the dev server, and every file of the static catalog at `/__zukan/…` under `vite preview`. Vite adds the user's `server.headers` (dev) or `preview.headers` (preview) to the responses of its own middlewares. The plugin's responses set only `content-type`. A user who configures a CSP, `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy`, `X-Frame-Options` and so on gets them on the app but not on the catalog page and its preview iframes, which are the same HTML. Hardening is silently missing there, and components that need cross-origin isolation (for example `SharedArrayBuffer`) work in the app but fail in the catalog.

## Current state

- `packages/svelte-zukan/src/lib/vite/index.ts:215-242` (`configureServer`). The HTML response:
  ```ts
  server
    .transformIndexHtml(path, html)
    .then((out) => {
      res.setHeader('content-type', 'text/html');
      res.end(out);
    })
    .catch(next);
  ```
- `index.ts:243-271` (`configurePreviewServer`). The file response:
  ```ts
  const file = normalizePath(resolve(out, rel));
  if (!isInside(file, out) || !existsSync(file) || !statSync(file).isFile()) return next();
  res.setHeader('content-type', CONTENT_TYPES[extname(file)] ?? 'application/octet-stream');
  res.end(readFileSync(file));
  ```
- In both hooks, `server.config` is Vite's `ResolvedConfig`. Its `server.headers` and `preview.headers` are `OutgoingHttpHeaders | undefined` (from `node:http`). Values may be `string | number | string[]`.
- `packages/svelte-zukan/src/lib/vite/index.test.ts`:
  - `fakeServer(root, base)` (lines 153–160) returns `{ config: { root, base, logger }, middlewares: { use: vi.fn() }, … }`.
  - `request(mw, url)` (lines 364–379) calls the middleware with a fake `res` whose `setHeader` records only `content-type` and `location` into `Res`.
  - `describe('configureServer')` (lines 381–442) and `describe('configurePreviewServer')` (lines 444–490) are the patterns for the new tests. `configurePreviewServer`'s `setup(base, options)` writes `zukan-dist/index.html` and `zukan-dist/_zukan/zukan-abc.js` and returns `{ server, mw }`.

Conventions: comments only for the non-obvious why; Prettier 120 columns, single quotes, no trailing commas.

## Commands you will need

| Purpose                                       | Command (from the repo root)                                  | Expected on success |
| --------------------------------------------- | ------------------------------------------------------------- | ------------------- |
| Install                                       | `pnpm install`                                                | exit 0              |
| Plugin unit tests                             | `pnpm --filter svelte-zukan exec vitest run --project server` | all pass            |
| Build tests (has a real `vite preview` check) | `pnpm --filter build-tests exec vitest run build.test.ts`     | all pass            |
| Type check                                    | `pnpm run package && pnpm run check`                          | exit 0              |
| Lint                                          | `pnpm run lint` (fix with `pnpm run format`)                  | exit 0              |

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/vite/index.ts`
- `packages/svelte-zukan/src/lib/vite/index.test.ts`
- `.changeset/catalog-configured-headers.md` (create)

**Out of scope**:

- The 302 redirects from `/__zukan` to `/__zukan/`: Vite sends its own redirects without these headers too.
- Adding any header of the plugin's own (CSP, `nosniff`, …): the user decides their policy.
- Docs: this makes the catalog behave like the app, which is what users already expect.

## Git workflow

- Branch: `advisor/020-catalog-configured-headers`
- Conventional Commits, e.g. `fix: send server.headers and preview.headers with the catalog's responses`
- Do not push or open a PR unless told to.

## Steps

### Step 1: Extend the test fakes and add failing tests

1. In `index.test.ts`, let `fakeServer` take headers: add a third parameter `headers?: Record<string, string | string[]>` and put `server: { headers }, preview: { headers }` into its `config`.
2. Let `request` record every header: add `headers: Record<string, unknown>` to `Res` (initialised to `{}`) and store `out.headers[k.toLowerCase()] = v` in `setHeader`, keeping the existing `type`/`location` fields. Existing `toEqual({ status: 'next' })` assertions must keep working: only include `headers` in the resolved object when at least one header was set, or change those assertions to `toMatchObject`. Pick one and apply it consistently.
3. Add tests:
   - In `describe('configureServer')`: with `fakeServer(root, '/', { 'cross-origin-embedder-policy': 'require-corp', 'x-test': ['a', 'b'] })`, the `/__zukan/` response has both headers and still `content-type` `text/html`.
   - In `describe('configurePreviewServer')`: extend `setup` with an optional headers argument passed to `fakeServer`. `/__zukan/` and `/__zukan/_zukan/zukan-abc.js` both carry the configured header, and the JS file's `content-type` still matches `/javascript/`.
   - Without headers, responses are unchanged (the existing tests cover this).

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/index.test.ts` → only the new header tests fail.

### Step 2: Apply the configured headers

In `index.ts`, add a small module-level helper near `printCatalogUrl`:

```ts
/** Vite adds these to its own responses; the catalog's responses are the same pages */
const setHeaders = (res: ServerResponse, headers: OutgoingHttpHeaders | undefined) => {
  for (const [name, value] of Object.entries(headers ?? {})) if (value !== undefined) res.setHeader(name, value);
};
```

(`import type { OutgoingHttpHeaders, ServerResponse } from 'node:http';`.) If the middleware's `res` type is not `ServerResponse`, type the parameter to what `server.middlewares.use` gives (`http.ServerResponse` in Vite 8's `Connect` types).

Call it before setting `content-type`:

- dev: `setHeaders(res, server.config.server.headers);`
- preview: `setHeaders(res, server.config.preview.headers);`

Setting `content-type` after the user's headers keeps the plugin's correct type even if the user configured a global `content-type`.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server` → all pass.

### Step 3: Real-server check, changeset, checks

**Verify**: `pnpm --filter build-tests exec vitest run build.test.ts -t "plain vite build"` → passes (its `vite preview` part fetches `/__zukan/` and a JS file from a real preview server).

Create `.changeset/catalog-configured-headers.md`:

```md
---
'svelte-zukan': patch
---

fix: the catalog page and the static catalog served by `vite preview` carry the headers from `server.headers` and `preview.headers`, like the app.
```

**Verify**: `pnpm run package && pnpm run check` → exit 0; `pnpm run lint` → exit 0.

## Test plan

- Dev `/__zukan/`: configured headers present (a string and an array value), `content-type` still HTML.
- Preview `/__zukan/` and a `_zukan/*.js` file: configured header present, correct `content-type`.
- Existing tests (no headers configured) unchanged.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run --project server` exits 0 with the new tests
- [ ] `grep -n "setHeaders(res" packages/svelte-zukan/src/lib/vite/index.ts` prints two lines
- [ ] `pnpm --filter build-tests exec vitest run build.test.ts` exits 0
- [ ] `pnpm run package && pnpm run check && pnpm run lint` exit 0
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- `server.config.server.headers` / `server.config.preview.headers` do not exist on the resolved config in the installed Vite (type errors in `pnpm run check`). Report the actual property path.
- An existing test fails because of the `Res` shape change and cannot be fixed by the `toMatchObject` / conditional-field choice in Step 1.

## Maintenance notes

- Any new response the plugin writes itself (for example another file type or route) should call `setHeaders` the same way.
- A user CSP that blocks module scripts from `/@id/` would also block the app's own dev scripts, so this change cannot break a working setup.
