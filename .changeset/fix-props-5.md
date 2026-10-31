---
'svelte-zukan': patch
---

fix: a generic props type (`WithElementRef<HTMLButtonAttributes, HTMLButtonElement>`, `ListProps<string>`) is read with its type arguments or defaults in place of its type parameters, instead of naming `T` as the props type and showing `T[]` or `U | null` as member types.

fix: a section's code no longer includes a script variable that the section only shadows with a name it declares itself (an `{#each}` item or index, a snippet or function parameter, an `{:then}` or `{:catch}` value, `{@const}`, `let:`).
