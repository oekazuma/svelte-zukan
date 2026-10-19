import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePath, searchForWorkspaceRoot } from 'vite';

export type ZukanOptions = {
  /** catalog file suffix: `Foo.<suffix>.svelte` / `Foo.<suffix>.md` (default 'zukan') */
  suffix?: string;
  /** group name -> directories to search (relative to the Vite root) */
  groups?: Record<string, string | string[]>;
  /** .svelte file wrapping every preview (relative to the Vite root) */
  wrapper?: string;
  /** logo image path (relative to the Vite root); false hides it */
  logo?: string | false;
  /** logo alt and <title> (default 'zukan') */
  title?: string;
  /** UI language (default 'en') */
  locale?: 'en' | 'ja';
  /** write the catalog as a static site on `vite build` (default false; outDir defaults to 'zukan-dist') */
  build?: boolean | { outDir?: string };
};

/** a file of the catalog SPA shipped with this library (`src/lib/app/` here, `dist/app/` when published) */
export const appFile = (name: string) => normalizePath(fileURLToPath(new URL(`../app/${name}`, import.meta.url)));

/** the library's own directory (`src/lib/` here, `dist/` when published); the SPA imports files from all over it */
export const libDir = normalizePath(fileURLToPath(new URL('..', import.meta.url))).replace(/\/$/, '');

const LOCALES = ['en', 'ja'];

const file = (root: string, key: string, rel: string) => {
  const abs = normalizePath(resolve(root, rel));
  if (!existsSync(abs) || !statSync(abs).isFile()) throw new Error(`svelte-zukan: ${key} not found: ${abs}`);
  return abs;
};

export function resolveOptions(root: string, options: ZukanOptions) {
  const { suffix = 'zukan', locale = 'en', wrapper, logo, build } = options;
  if (!LOCALES.includes(locale))
    throw new Error(`svelte-zukan: unknown locale "${locale}" (use ${LOCALES.map((l) => `"${l}"`).join(' or ')})`);
  return {
    suffix,
    wrapper: wrapper === undefined ? null : file(root, 'wrapper', wrapper),
    logo: logo === false ? null : logo === undefined ? appFile('logo.svg') : file(root, 'logo', logo),
    title: options.title ?? 'zukan',
    locale,
    /** outDir of the static catalog, or false when it is not built */
    build: build ? normalizePath(resolve(root, (build !== true && build.outDir) || 'zukan-dist')) : (false as const)
  };
}

export const isInside = (dir: string, parent: string) =>
  dir === parent || dir.startsWith(parent.replace(/\/$/, '') + '/');

/**
 * `server.fs.allow` with the dirs outside the root added, or undefined when nothing has to be added.
 * Without a list, Vite's default (the workspace root) is kept; an explicit list, such as SvelteKit's, is not widened.
 */
export function extendFsAllow(root: string, dirs: string[], allow: string[] | undefined): string[] | undefined {
  const outside = dirs.filter((dir) => !isInside(normalizePath(dir), normalizePath(root)));
  return outside.length ? [...(allow ?? [searchForWorkspaceRoot(root)]), ...outside] : undefined;
}
