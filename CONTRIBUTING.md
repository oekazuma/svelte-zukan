# svelte-zukan Contributing Guide

Hi! We are really excited that you are interested in contributing to svelte-zukan. Before submitting your contribution, please make sure to take a moment and read through the following guide:

## What belongs in svelte-zukan

svelte-zukan is a component catalog and nothing else. Its users pick it because it is small, needs no setup beyond one line, and has little to keep up to date. Before proposing a feature, check it against these:

- **It helps someone look at, check, or document a component.** Previews, widths, themes, the code view, the props table, accessibility checks and the data for agents do. Props controls, an event log, interaction or visual tests, and an addon system do not; those are what Storybook is for
- **It works without configuration.** A new `zukan()` option is the last resort, not the first: the option set is small on purpose (`suffix`, `groups`, `wrapper`, `logo`, `title`, `locale`, `theme`, `build`)
- **It adds no dependency for something a few lines can do.** A runtime dependency reaches every user's install and every user's upgrade
- **Catalog files stay plain Svelte.** No story format, no special syntax beyond `<Section>`, nothing an agent or a person has to learn first
- **It works the same in plain Vite and in SvelteKit**, on the app's own dev server, without mocking the app's runtime

If a feature needs one of these broken, open an issue to talk it through first.

## Project Set Up

It requires [pnpm](https://pnpm.io/). The pnpm version is pinned via `packageManager` in the root `package.json`, and pnpm downloads the Node.js version pinned via `devEngines.runtime`, so `pnpm install` sets up both.

1. Pull the repo and install the dependencies:

```
git clone git@github.com:oekazuma/svelte-zukan.git
pnpm install
```

2. Make your modifications / additions
3. Update / Add Documentation in `docs/content/` and its Japanese mirror `docs/content/ja/`
4. Write / Update Tests
5. Run the same checks CI runs before opening a pull request (the first time, install Chromium for the browser tests: see [Browser tests](#browser-tests)):

```bash
pnpm run lint                      # Prettier + ESLint
pnpm run package                   # svelte-kit sync && svelte-package && publint (the example app, check and dev.test.ts use the built package)
pnpm run check                     # svelte-kit sync && svelte-check
pnpm --filter example build        # the example app, built against the packaged library
pnpm --filter docs build           # the documentation site
pnpm run test                      # Vitest: the library's server and browser tests, and the build tests
pnpm --filter svelte-zukan build   # the library's own site and catalog (zukan-dist/)
```

Run `pnpm run format` to auto-fix formatting issues found by `pnpm run lint`.

6. For a user-facing change, add a changeset: write `.changeset/<short-slug>.md` with `'svelte-zukan': patch` (or `minor` / `major`) in the front matter and one English sentence. Tests, CI, docs and the example app need none.
7. Open pull request. Write commit messages and the PR description in English, using Conventional Commits prefixes (`feat:`, `fix:`, `chore:`, `docs:`). Write changesets in English too.

## Work with svelte-zukan

- `packages/svelte-zukan/` is the published library. The code is in `src/lib/`: the Vite plugin in `src/lib/vite/` and the catalog SPA in `src/lib/app/`. The package also uses itself: `pnpm --filter svelte-zukan dev` serves this repository's own catalog at `/__zukan/` (the `ui` group is `src/lib`, the `examples` group is `src/examples`, or its Japanese copy `src/examples-ja` with `ZUKAN_DEMO_LOCALE=ja`, which also replaces `ui` with `src/ui-ja`; change both together), and `pnpm --filter svelte-zukan build` writes it to `zukan-dist/`.
- `example/` is a SvelteKit app that uses the built package (`packages/svelte-zukan/dist`) through `workspace:*`. Run `pnpm run package` first, then `pnpm --filter example dev` or `pnpm --filter example build`.
- `tests/build/` builds the fixtures in `tests/build/monorepo/` (SvelteKit in a monorepo) and `tests/build/vite-svelte/` (plain Vite + Svelte) with the library's source, and checks the written catalog. Set `ZUKAN_FROM_DIST=1` to build with the packaged library instead. `dev.test.ts` also starts a dev server with the packaged library, so run `pnpm run package` first.
- `docs/` is the documentation site (Blume). English pages are in `docs/content/`, Japanese pages in `docs/content/ja/`; update both. Run `pnpm --filter docs dev` to preview it.

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

Add a changeset with every user-facing change. On each push to `main`, the release workflow opens or updates a "Version Packages" pull request that bumps the version and writes `CHANGELOG.md`; merging it publishes to npm with provenance (npm trusted publishing, no token in the repository). Do not bump versions or edit `CHANGELOG.md` by hand.
