const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function renderHtml(opts: { title: string; locale: 'en' | 'ja'; entrySrc: string; icon: string }): string {
  return `<!doctype html>
<html lang="${opts.locale}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(opts.icon)}">
    <title>${escapeHtml(opts.title)}</title>
    <script type="module" src="${escapeHtml(opts.entrySrc)}"></script>
  </head>
  <body></body>
</html>
`;
}
