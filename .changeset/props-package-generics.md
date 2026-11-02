---
'svelte-zukan': patch
---

fix: read a package's generic types in the props table.

- A package's generic type now takes its type arguments and defaults, so members it adds through `WithChild<{ orientation?: string }>` get a type and `onclick` of `HTMLAttributes<HTMLDivElement>` names `HTMLDivElement`.
- `Omit` and `Pick` with `keyof` of a type the table can read, and a conditional type such as `T extends { child?: any } ? Omit<T, 'child'> : T`, now list their members.
- Imports are now followed up to seven files deep instead of six, which reaches `svelte/elements` from a type of `bits-ui`.
