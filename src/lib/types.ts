import type { Component } from 'svelte';

export type ZukanSection = { title: string; code: string };

export type ZukanMeta = { sections: ZukanSection[]; doc: string | null };

export type Groups = Record<string, Record<string, () => Promise<unknown>>>;

export type ZukanModule = { default: Component; __zukan?: ZukanMeta };

export type Entry = {
  group: string;
  name: string;
  path: string;
  load: () => Promise<ZukanModule>;
};

/** a group of directories to search for catalog files; `dirs` are absolute and normalized */
export type CatalogGroup = { name: string; dirs: string[] };

/** `path` is the catalog ID (`<group>/<rel>`); `dir` is `<rel>` without `name` ('' at the root) */
export type CatalogItem = { group: string; name: string; dir: string; path: string; file: string };
