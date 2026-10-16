const flatten = async (list: unknown[]): Promise<unknown[]> =>
  (
    await Promise.all(
      list.map(async (item) => {
        const p = await item;
        return Array.isArray(p) ? flatten(p) : [p];
      })
    )
  ).flat();

/** whether `sveltekit()` is among the plugins (it returns a Promise, so the list is awaited and flattened) */
export async function detectSvelteKit(plugins: unknown[]): Promise<boolean> {
  return (await flatten(plugins)).some((p) => {
    const name = (p as { name?: unknown } | null)?.name;
    return typeof name === 'string' && name.startsWith('vite-plugin-sveltekit');
  });
}
