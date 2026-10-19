export type Route =
  { view: 'list' } | { view: 'detail'; path: string } | { view: 'preview'; path: string; section: string | null };

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

/** `#/<ID>` or `#/preview/<ID>?section=<title>`; IDs encode `?` per segment, so the first `?` starts the query */
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const q = raw.indexOf('?');
  const rawPath = q === -1 ? raw : raw.slice(0, q);
  if (rawPath.startsWith(PREVIEW)) {
    const section = q === -1 ? null : new URLSearchParams(raw.slice(q + 1)).get('section');
    return { view: 'preview', path: rawPath.slice(PREVIEW.length).split('/').map(decode).join('/'), section };
  }
  const path = rawPath.split('/').map(decode).join('/');
  return path ? { view: 'detail', path } : { view: 'list' };
}

export function formatHash(view: 'detail' | 'preview', path: string, section?: string): string {
  if (view === 'detail') return `#/${encodePath(path)}`;
  return `#/${PREVIEW}${encodePath(path)}${section === undefined ? '' : `?section=${encodeURIComponent(section)}`}`;
}
