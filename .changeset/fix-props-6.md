---
'svelte-zukan': patch
---

fix: a circular type parameter default (`type P<T = T>`) no longer crashes the catalog; a generic type given itself as an argument (`W<W<{ x: 1 }>>`) lists all of its props; `Omit` and `Pick` whose keys are a type parameter are expanded; a function or conditional type argument is parenthesized in a conditional type; and a `for` loop variable in a section no longer pulls in the script variable of the same name.
