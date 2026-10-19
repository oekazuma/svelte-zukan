import type { Component } from 'svelte';

export type ZukanSection = { title: string; code: string };

export type ZukanMeta = { sections: ZukanSection[]; doc: string | null };

export type ZukanModule = { default: Component; __zukan?: ZukanMeta };

/** a group of directories to search for catalog files; `dirs` are absolute and normalized */
export type CatalogGroup = { name: string; dirs: string[] };

/** `path` is the catalog ID (`<group>/<rel>`); `dir` is `<rel>` without `name` ('' at the root) */
export type CatalogItem = { group: string; name: string; dir: string; path: string; file: string };

/** an item of the virtual catalog module (`file` is left out so absolute paths stay out of the build) */
export type Entry = Omit<CatalogItem, 'file'> & { load: () => Promise<ZukanModule> };
