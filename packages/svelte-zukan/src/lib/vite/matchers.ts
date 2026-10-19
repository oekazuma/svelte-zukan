export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createMatchers(suffix: string) {
  if (!/^[a-z0-9-]+$/i.test(suffix))
    throw new Error(`svelte-zukan: invalid suffix "${suffix}" (use letters, digits and "-")`);
  const ext = `.${suffix}.svelte`;
  const docExt = `.${suffix}.md`;
  const isCatalogFile = (file: string) => file.endsWith(ext);
  return {
    isCatalogFile,
    isDocFile: (file: string) => file.endsWith(docExt),
    docFileOf: (catalogFile: string) => catalogFile.slice(0, -ext.length) + docExt,
    catalogFileOf: (docFile: string) => docFile.slice(0, -docExt.length) + ext
  };
}
