import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePath } from 'vite';
import { createMatchers } from './matchers.js';

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

const LOCALES = ['en', 'ja'];

const file = (root: string, key: string, rel: string) => {
  const abs = normalizePath(resolve(root, rel));
  if (!existsSync(abs)) throw new Error(`svelte-zukan: ${key} not found: ${abs}`);
  return abs;
};

export function resolveOptions(root: string, options: ZukanOptions) {
  const { suffix = 'zukan', locale = 'en', wrapper, logo } = options;
  createMatchers(suffix);
  if (!LOCALES.includes(locale))
    throw new Error(`svelte-zukan: unknown locale "${locale}" (use ${LOCALES.map((l) => `"${l}"`).join(' or ')})`);
  return {
    suffix,
    groups: options.groups,
    wrapper: wrapper === undefined ? null : file(root, 'wrapper', wrapper),
    logo: logo === false ? null : logo === undefined ? appFile('logo.svg') : file(root, 'logo', logo),
    title: options.title ?? 'zukan',
    locale,
    build: options.build ?? false
  };
}
