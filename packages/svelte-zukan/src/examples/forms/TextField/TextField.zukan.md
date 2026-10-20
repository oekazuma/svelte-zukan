A labelled text input. The label, the hint and the error are wired to the input (`for`, `aria-describedby`, `aria-invalid`), so screen readers read them with it.

- `label`: always visible
- `value`: bindable with `bind:value`
- `hint`: a line under the field
- `error`: replaces the hint and marks the field invalid
- `icon`: an icon name shown inside the field
- any other `<input>` attribute, such as `type`, `placeholder` or `disabled`
