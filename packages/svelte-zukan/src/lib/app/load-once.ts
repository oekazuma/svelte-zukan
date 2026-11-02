// Back renders the page at once, before the browser restores its position, and a promise renders `then` only later, on
// a page cut short. A `zukan:reload` reloads the whole page, which empties this
const loaded = new WeakMap<() => Promise<unknown>, unknown>();

/** the value of an earlier load as it is, for `{#await}` to render at once; a load that failed is tried again */
export function loadOnce<T>(load: () => Promise<T>): T | Promise<T> {
  return loaded.has(load) ? (loaded.get(load) as T) : load().then((value) => (loaded.set(load, value), value));
}
