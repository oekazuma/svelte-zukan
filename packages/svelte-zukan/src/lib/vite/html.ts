const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function renderHtml(opts: {
  title: string;
  locale: 'en' | 'ja';
  entrySrc: string;
  icon: string;
  theme?: 'light' | 'dark' | null;
  /** a classic script, run before the module entry */
  script?: string;
}): string {
  // a fixed theme is known before the app mounts, so the page never paints the other one first
  const scheme = opts.theme ? `\n    <meta name="color-scheme" content="${opts.theme}">` : '';
  const script = opts.script ? `\n    <script>${opts.script}</script>` : '';
  return `<!doctype html>
<html lang="${opts.locale}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">${scheme}
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(opts.icon)}">
    <title>${escapeHtml(opts.title)}</title>${script}
    <script type="module" src="${escapeHtml(opts.entrySrc)}"></script>
  </head>
  <body></body>
</html>
`;
}
