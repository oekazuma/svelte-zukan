<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg" />
    <img src=".github/logo.svg" alt="zukan" width="320" />
  </picture>
</p>

<p align="center">
  A component catalog for Svelte. Put a catalog file next to a component and you get a list, a live preview, and a code view.
</p>

<p align="center">
  <b>English</b> | <a href="README.ja.md">日本語</a>
</p>

"zukan" (図鑑) is Japanese for "illustrated encyclopedia".

## Quick start

```sh
npm install -D svelte-zukan
```

Add `zukan()` before `sveltekit()` (or `svelte()`) in `vite.config.ts`, put `Button.zukan.svelte` next to `Button.svelte`, and open `/__zukan/` on the dev server. The [quickstart](https://oekazuma.github.io/svelte-zukan/quickstart/) shows both files.

## Links

- [Documentation](https://oekazuma.github.io/svelte-zukan/)
- [Demo](https://oekazuma.github.io/svelte-zukan/demo/)
- [Using it with AI agents](https://oekazuma.github.io/svelte-zukan/guides/ai-agents/)
- [Contribution Guide](CONTRIBUTING.md)

> svelte-zukan is not an official Svelte project (not affiliated with or endorsed by the Svelte team). The S shape in the logo is derived from the Svelte logo.

## License

[MIT](LICENSE.md)
