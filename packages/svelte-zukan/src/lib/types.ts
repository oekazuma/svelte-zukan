import type { Component } from 'svelte';

export type ZukanSection = { title: string; code: string };

/** `type` and `default` are source text; `description` is the JSDoc comment rendered as inline Markdown */
export type ZukanProp = {
  name: string;
  type: string | null;
  default: string | null;
  required: boolean;
  bindable: boolean;
  description: string | null;
};

/** `props` is null when the component next to the catalog file declares none; `propsType` names a type it imports */
export type ZukanMeta = {
  sections: ZukanSection[];
  doc: string | null;
  props?: ZukanProp[] | null;
  propsType?: string | null;
};

export type ZukanModule = { default: Component };

/** a group of directories to search for catalog files; `dirs` are absolute and normalized */
export type CatalogGroup = { name: string; dirs: string[] };

/** `path` is the catalog ID (`<group>/<rel>`); `dir` is `<rel>` without `name` ('' at the root) */
export type CatalogItem = { group: string; name: string; dir: string; path: string; file: string };

/** an item of the virtual catalog module (`file` is left out so absolute paths stay out of the build) */
export type Entry = Omit<CatalogItem, 'file'> & {
  /** absolute paths, on the dev server only */
  edit?: { file: string; component: string | null };
  load: () => Promise<ZukanModule>;
  meta: () => Promise<{ default: ZukanMeta }>;
};
