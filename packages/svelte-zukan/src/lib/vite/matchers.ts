export function createMatchers(suffix: string) {
  if (!/^[a-z0-9-]+$/i.test(suffix))
    throw new Error(`svelte-zukan: invalid suffix "${suffix}" (use letters, digits and "-")`);
  const ext = `.${suffix}.svelte`;
  const docExt = `.${suffix}.md`;
  return {
    isCatalogFile: (file: string) => file.endsWith(ext),
    isDocFile: (file: string) => file.endsWith(docExt),
    docFileOf: (catalogFile: string) => catalogFile.slice(0, -ext.length) + docExt,
    componentFileOf: (catalogFile: string) => catalogFile.slice(0, -ext.length) + '.svelte'
  };
}
