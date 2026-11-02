---
'svelte-zukan': patch
---

fix: read more of how props and catalog files are written.

- `Omit` and `Pick` over a package type now give the destructured members their types, as the package type does.
- A nested object type without semicolons (Prettier's `semi: false`) no longer prints as invalid text such as `{ id: string label: string }`, and a class default keeps its lines.
- `$props() as Props`, `$props() satisfies Props`, `<Props>$props()` and `$props()!` now give a props table, also for `ComponentProps<typeof X>`.
- `$bindable()` inside `!`, `as` or `satisfies` is now seen as bindable, with its default.
- The code view no longer shows a script variable or type just because a name inside a TypeScript type matches it: parameter names in function types, method signatures and overloads, index signatures, tuple labels, type parameters, and the name of a function or class expression. `typeof x` and type references still count.
- An `@` line in a JSDoc code block (`@media` in a fence) no longer cuts the description.
- A script that is not indented, with a JSDoc comment and tabs in its code, gets tabs in the code view.
- The code view keeps the lines of a multi-line attribute value as written, instead of changing the value it shows.
