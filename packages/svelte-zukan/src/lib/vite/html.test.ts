import { describe, expect, it } from 'vitest';
import { renderHtml } from './html.js';

const icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1z" fill="#ff3e00"/></svg>';
const html = renderHtml({
  title: 'A <b> & "c"',
  locale: 'ja',
  entrySrc: '/@id/__x00__virtual:svelte-zukan/entry',
  icon
});

describe('renderHtml', () => {
  it('sets lang, title and the entry script', () => {
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain('<title>A &lt;b&gt; &amp; &quot;c&quot;</title>');
    expect(html).toContain('<script type="module" src="/@id/__x00__virtual:svelte-zukan/entry"></script>');
  });

  it('sets color-scheme only for a fixed theme', () => {
    expect(html).not.toContain('name="color-scheme"');
    const dark = renderHtml({ title: 'zukan', locale: 'en', entrySrc: '/e.js', icon, theme: 'dark' });
    expect(dark).toContain('<meta name="color-scheme" content="dark">');
  });

  it('embeds the icon as a data URL', () => {
    const href = html.match(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,([^"]*)">/)?.[1];
    expect(href).toBeDefined();
    expect(decodeURIComponent(href!)).toBe(icon);
  });
});
