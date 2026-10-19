const flatten = async (list: unknown[]): Promise<unknown[]> =>
  (
    await Promise.all(
      list.map(async (item) => {
        const p = await item;
        return Array.isArray(p) ? flatten(p) : [p];
      })
    )
  ).flat();

type KitSetup = { name: string; api?: { options?: { outDir?: string } } };

/**
 * SvelteKit's setup plugin when `sveltekit()` is among the plugins (it returns a Promise, so the list is awaited and flattened).
 * Its `api.options` is the Kit config; Kit 3 has no `kit` key, so `kit.outDir` is `api.options.outDir`.
 */
export async function detectSvelteKit(plugins: unknown[]): Promise<KitSetup | undefined> {
  return (await flatten(plugins)).find(
    (p): p is KitSetup => (p as KitSetup | null)?.name === 'vite-plugin-sveltekit-setup'
  );
}
