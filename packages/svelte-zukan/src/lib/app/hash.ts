export type Route =
  | { view: 'list' }
  | { view: 'detail'; path: string; section: string | null }
  | { view: 'preview'; path: string; section: string | null };

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

/** `#/<ID>[?section=<title>]` or `#/preview/<ID>[?section=<title>]`; IDs encode `?` per segment, so the first `?` starts the query */
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const q = raw.indexOf('?');
  const rawPath = q === -1 ? raw : raw.slice(0, q);
  const section = q === -1 ? null : new URLSearchParams(raw.slice(q + 1)).get('section');
  if (rawPath.startsWith(PREVIEW)) {
    return { view: 'preview', path: rawPath.slice(PREVIEW.length).split('/').map(decode).join('/'), section };
  }
  const path = rawPath.split('/').map(decode).join('/');
  return path ? { view: 'detail', path, section } : { view: 'list' };
}

export function formatHash(view: 'detail' | 'preview', path: string, section?: string): string {
  const query = section === undefined ? '' : `?section=${encodeURIComponent(section)}`;
  return `#/${view === 'preview' ? PREVIEW : ''}${encodePath(path)}${query}`;
}
