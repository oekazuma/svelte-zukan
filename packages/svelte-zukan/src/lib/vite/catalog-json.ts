import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { normalizePath } from 'vite';
import { formatHash } from '../app/hash.js';
import type { CatalogItem, TailwindSource, ZukanProp } from '../types.js';
import { existsExactly } from './discover.js';
import { extractSections, normalizeSource } from './extract.js';
import { extractProps } from './props.js';

/**
 * The catalog as data, for tools and AI agents: what `/__zukan/catalog.json` serves and the static build writes.
 * Paths are relative to the Vite root; `preview` is a hash on the catalog page.
 */
export type CatalogJson = {
  title: string;
  components: {
    id: string;
    group: string;
    name: string;
    dir: string;
    /** the catalog file */
    file: string;
    /** `Button.svelte` next to `Button.zukan.svelte`, when it exists */
    component: string | null;
    /** the `.md` next to the catalog file, as Markdown */
    doc: string | null;
    props: ZukanProp[] | null;
    propsType: string | null;
    sections: { title: string; code: string; preview: string }[];
    /** why the catalog file could not be read; its sections are then empty */
    error?: string;
  }[];
  /** `.svelte` files in the scanned directories with no catalog file next to them */
  uncataloged: { group: string; file: string }[];
  /** one item per Tailwind CSS entry, without its sample CSS; null when none was loaded */
  tailwind: Omit<TailwindSource, 'id' | 'css'>[] | null;
};

export function catalogJson(opts: {
  root: string;
  title: string;
  items: CatalogItem[];
  uncataloged: { group: string; file: string }[];
  docFileOf: (file: string) => string;
  componentFileOf: (file: string) => string;
  tailwind: TailwindSource[];
}): CatalogJson {
  const rel = (file: string) => normalizePath(relative(opts.root, file));
  const read = (file: string) => normalizeSource(readFileSync(file, 'utf-8'));
  return {
    title: opts.title,
    components: opts.items.map((item) => {
      const component = opts.componentFileOf(item.file);
      const docFile = opts.docFileOf(item.file);
      const found = existsExactly(component) ? extractProps(read(component), component) : null;
      let sections: CatalogJson['components'][number]['sections'] = [];
      let error: string | undefined;
      try {
        sections = extractSections(read(item.file), rel(item.file)).map((s) => ({
          ...s,
          preview: formatHash('preview', item.path, s.title)
        }));
      } catch (e) {
        // a failed read names the file by the path it was opened with
        error = (e instanceof Error ? e.message : String(e)).replaceAll(item.file, rel(item.file));
      }
      return {
        id: item.path,
        group: item.group,
        name: item.name,
        dir: item.dir,
        file: rel(item.file),
        component: existsExactly(component) ? rel(component) : null,
        doc: existsExactly(docFile) ? read(docFile) : null,
        props: found?.props ?? null,
        propsType: found?.typeName ?? null,
        sections,
        ...(error !== undefined && { error })
      };
    }),
    uncataloged: opts.uncataloged.map((u) => ({ group: u.group, file: rel(u.file) })),
    tailwind: opts.tailwind.length
      ? opts.tailwind.map(({ file, version, prefix, categories, variables, error }) => ({
          file,
          version,
          prefix,
          categories,
          variables,
          ...(error !== undefined && { error })
        }))
      : null
  };
}
