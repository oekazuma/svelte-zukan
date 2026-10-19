# svelte-zukan Contributing Guide

Hi! We are really excited that you are interested in contributing to svelte-zukan. Before submitting your contribution, please make sure to take a moment and read through the following guide:

## Project Set Up

It requires [pnpm](https://pnpm.io/). The pnpm version is pinned via `packageManager` in the root `package.json`, and pnpm downloads the Node.js version pinned via `devEngines.runtime`, so `pnpm install` sets up both.

1. Pull the repo and install the dependencies:

```
git clone git@github.com:oekazuma/svelte-zukan.git
pnpm install
```

2. Make your modifications / additions
3. Update / Add Documentation (`packages/svelte-zukan/README.md`)
4. Write / Update Tests
5. Run the same checks CI runs before opening a pull request (the first time, install Chromium for the browser tests: see [Browser tests](#browser-tests)):

```bash
pnpm run lint      # Prettier + ESLint
pnpm run package   # svelte-kit sync && svelte-package && publint (the example app and check use the built package)
pnpm run check     # svelte-kit sync && svelte-check
pnpm run test      # Vitest: the library's server and browser tests, and the build tests
```

Run `pnpm run format` to auto-fix formatting issues found by `pnpm run lint`.

6. Open pull request

## Work with svelte-zukan

- `packages/svelte-zukan/` is the published library. The code is in `src/lib/`: the Vite plugin in `src/lib/vite/` and the catalog SPA in `src/lib/app/`. The package also uses itself: `pnpm --filter svelte-zukan dev` serves this repository's own catalog at `/__zukan/` (the `ui` group is `src/lib`, the `examples` group is `src/examples`), and `pnpm --filter svelte-zukan build` writes it to `zukan-dist/`.
- `example/` is a SvelteKit app that uses the built package (`packages/svelte-zukan/dist`) through `workspace:*`. Run `pnpm run package` first, then `pnpm --filter example dev` or `pnpm --filter example build`.
- `tests/build/` builds the fixtures in `tests/build/monorepo/` (SvelteKit in a monorepo) and `tests/build/vite-svelte/` (plain Vite + Svelte) with the library's source, and checks the written catalog.
- `docs/` has the design (`docs/specs/`) and the plans (`docs/plans/`).

### Browser tests

The library's `client` tests run in Chromium through Vitest's browser mode and Playwright. Install the browser once:

```bash
pnpm --filter svelte-zukan exec playwright install chromium
```

Then run one side only with:

```bash
pnpm --filter svelte-zukan exec vitest run --project client
pnpm --filter svelte-zukan exec vitest run --project server
pnpm --filter build-tests test
```

## Releases

The [Changesets GitHub action](https://github.com/changesets/action#with-publishing) will create and update a PR that applies changesets and publishes new versions of changed packages to npm.

svelte-zukan has not been released yet: `packages/svelte-zukan/package.json` has `"private": true` so that nothing is published. Before the first release, remove `"private": true` and add the first changeset.
