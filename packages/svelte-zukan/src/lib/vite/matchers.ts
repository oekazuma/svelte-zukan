export const SVELTE_STYLE_ID = /[?&]svelte&type=style/;

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createMatchers(suffix: string) {
  if (!/^[a-z0-9-]+$/i.test(suffix))
    throw new Error(`svelte-zukan: invalid suffix "${suffix}" (use letters, digits and "-")`);
  const ext = `.${suffix}.svelte`;
  const docExt = `.${suffix}.md`;
  const catalogId = new RegExp(`^[^?#]+\\.${escapeRegExp(suffix)}\\.svelte(?:[?#]|$)`);
  const isCatalogFile = (file: string) => file.endsWith(ext);
  return {
    catalogId,
    isCatalogId: (id: string) => catalogId.test(id) && !id.startsWith('\0') && !SVELTE_STYLE_ID.test(id),
    isCatalogFile,
    isDocFile: (file: string) => file.endsWith(docExt),
    docFileOf: (catalogFile: string) => catalogFile.slice(0, -ext.length) + docExt,
    catalogFileOf: (docFile: string) => docFile.slice(0, -docExt.length) + ext
  };
}
