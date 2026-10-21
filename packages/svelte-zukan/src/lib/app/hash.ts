import type { Theme } from '../components/PreviewFrame/storage.js';

/** `width` and `theme` reproduce a shared view; they are undefined when the link does not set them */
export type View = { width?: number; theme?: Theme };

export type Route =
  | { view: 'list' }
  | ({ view: 'detail'; path: string; section: string | null } & View)
  | ({ view: 'preview'; path: string; section: string | null } & View);

const PREVIEW = 'preview/';

// a hand-typed '%' must not crash the app; the ID simply won't match
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

function viewOf(params: URLSearchParams): View {
  const width = Number(params.get('width'));
  const theme = params.get('theme');
  return {
    width: Number.isInteger(width) && width > 0 ? width : undefined,
    theme: theme === 'light' || theme === 'dark' ? theme : undefined
  };
}

/** `#/<ID>[?section=<title>]` or `#/preview/<ID>[?section=<title>]`; IDs encode `?` per segment, so the first `?` starts the query */
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const q = raw.indexOf('?');
  const rawPath = q === -1 ? raw : raw.slice(0, q);
  const params = new URLSearchParams(q === -1 ? '' : raw.slice(q + 1));
  const section = params.get('section');
  if (rawPath.startsWith(PREVIEW)) {
    const path = rawPath.slice(PREVIEW.length).split('/').map(decode).join('/');
    return { view: 'preview', path, section, ...viewOf(params) };
  }
  const path = rawPath.split('/').map(decode).join('/');
  return path ? { view: 'detail', path, section, ...viewOf(params) } : { view: 'list' };
}

export function formatHash(view: 'detail' | 'preview', path: string, section?: string, shared: View = {}): string {
  const params = new URLSearchParams();
  if (section !== undefined) params.set('section', section);
  if (shared.width) params.set('width', String(shared.width));
  if (shared.theme) params.set('theme', shared.theme);
  // URLSearchParams writes spaces as '+'; the hash keeps the %20 that encodeURIComponent writes
  const query = [...params].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `#/${view === 'preview' ? PREVIEW : ''}${encodePath(path)}${query && `?${query}`}`;
}
