import { existsSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { normalizePath } from 'vite';
import { formatHash } from '../app/hash.js';
import type { CatalogItem, ZukanProp } from '../types.js';
import { extractSections } from './extract.js';
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
};

export function catalogJson(opts: {
  root: string;
  title: string;
  items: CatalogItem[];
  docFileOf: (file: string) => string;
  componentFileOf: (file: string) => string;
}): CatalogJson {
  const rel = (file: string) => normalizePath(relative(opts.root, file));
  const read = (file: string) => readFileSync(file, 'utf-8');
  return {
    title: opts.title,
    components: opts.items.map((item) => {
      const component = opts.componentFileOf(item.file);
      const docFile = opts.docFileOf(item.file);
      const found = existsSync(component) ? extractProps(read(component), component) : null;
      let sections: CatalogJson['components'][number]['sections'] = [];
      let error: string | undefined;
      try {
        sections = extractSections(read(item.file), item.file).map((s) => ({
          ...s,
          preview: formatHash('preview', item.path, s.title)
        }));
      } catch (e) {
        // relative like the other paths, so the static build carries no local path
        error = (e instanceof Error ? e.message : String(e)).replaceAll(opts.root + '/', '');
      }
      return {
        id: item.path,
        group: item.group,
        name: item.name,
        dir: item.dir,
        file: rel(item.file),
        component: existsSync(component) ? rel(component) : null,
        doc: existsSync(docFile) ? read(docFile) : null,
        props: found?.props ?? null,
        propsType: found?.typeName ?? null,
        sections,
        ...(error !== undefined && { error })
      };
    })
  };
}
