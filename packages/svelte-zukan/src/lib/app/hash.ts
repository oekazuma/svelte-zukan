import type { Theme } from '../components/PreviewFrame/storage.js';

/** `width` and `theme` reproduce a shared view; they are undefined when the link does not set them */
export type View = { width?: number; theme?: Theme };

export type Route =
  | { view: 'list' }
  | ({ view: 'detail'; path: string; section: string | null } & View)
  | ({ view: 'preview'; path: string; section: string | null } & View)
  | { view: 'tailwind'; source: string | null; category: string | null };

const PREVIEW = 'preview/';
// a single segment, while every component ID has a group prefix
const TAILWIND = 'tailwind';

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

/** `#/<ID>[?section=<title>]`, `#/preview/<ID>[?section=<title>]` or `#/tailwind[?source=<id>&category=<id>]`; IDs encode `?` per segment, so the first `?` starts the query */
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const q = raw.indexOf('?');
  const rawPath = q === -1 ? raw : raw.slice(0, q);
  const params = new URLSearchParams(q === -1 ? '' : raw.slice(q + 1));
  const section = params.get('section');
  if (rawPath === TAILWIND) return { view: 'tailwind', source: params.get('source'), category: params.get('category') };
  if (rawPath.startsWith(PREVIEW)) {
    const path = rawPath.slice(PREVIEW.length).split('/').map(decode).join('/');
    return { view: 'preview', path, section, ...viewOf(params) };
  }
  const path = rawPath.split('/').map(decode).join('/');
  return path ? { view: 'detail', path, section, ...viewOf(params) } : { view: 'list' };
}

// URLSearchParams writes spaces as '+'; the hash keeps the %20 that encodeURIComponent writes
const query = (params: URLSearchParams) => [...params].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

export function formatHash(view: 'detail' | 'preview', path: string, section?: string, shared: View = {}): string {
  const params = new URLSearchParams();
  if (section !== undefined) params.set('section', section);
  if (shared.width) params.set('width', String(shared.width));
  if (shared.theme) params.set('theme', shared.theme);
  const q = query(params);
  return `#/${view === 'preview' ? PREVIEW : ''}${encodePath(path)}${q && `?${q}`}`;
}

export function formatTailwindHash(source?: string, category?: string): string {
  const params = new URLSearchParams();
  if (source !== undefined) params.set('source', source);
  if (category !== undefined) params.set('category', category);
  const q = query(params);
  return `#/${TAILWIND}${q && `?${q}`}`;
}
