Switches between panels in place. Each item passes its panel as a snippet, and the code view shows the snippets each section uses.

- `items`: `{ id, label, panel }[]`
- `selected`: the `id` of the open tab, bindable with `bind:selected`
- `variant`: `underline` (default) or `pills`

The tabs follow the WAI-ARIA tabs pattern: arrow keys, Home and End move the focus and the selection.
