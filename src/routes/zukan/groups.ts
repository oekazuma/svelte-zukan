import type { Groups } from 'svelte-zukan';

export const groups: Groups = {
  ui: import.meta.glob('/src/lib/**/zukan/*.zukan.svelte'),
  examples: import.meta.glob('/src/examples/**/zukan/*.zukan.svelte')
};
