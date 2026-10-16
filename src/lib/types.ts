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
