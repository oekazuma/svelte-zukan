---
'svelte-zukan': patch
---

fix: read props and section code more faithfully. A type that Prettier breaks into lines no longer starts with `|` or `&`, `export *` passes on an `export const` / `export declare const` component, a JSDoc written on the line of the member before is read, and a fenced code block in a JSDoc no longer shows its language. Section code keeps the lines of a template literal as written and no longer pulls in a definition for an imported name, `import.meta`, a qualified type name, an enum member or a label. A `<Section>` inside a block or an element now says it must be at the top level of the file.
