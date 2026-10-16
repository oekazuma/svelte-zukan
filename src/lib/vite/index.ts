import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import type { Plugin } from 'vite';
import { transformZukan } from './extract.js';

const ZUKAN_ID = /^[^?#]+\.zukan\.svelte(?:[?#]|$)/;
const SVELTE_STYLE_ID = /[?&]svelte&type=style/;

export const isZukanId = (id: string) => ZUKAN_ID.test(id) && !id.startsWith('\0') && !SVELTE_STYLE_ID.test(id);

const isDocument = (file: string) =>
  path.basename(file) === 'Document.md' && path.basename(path.dirname(file)) === 'zukan';

export function zukan(): Plugin {
  return {
    name: 'vite-plugin-svelte-zukan',
    enforce: 'pre',
    transform: {
      filter: { id: { include: ZUKAN_ID, exclude: [/^\0/, SVELTE_STYLE_ID] } },
      handler(code, id) {
        if (!isZukanId(id)) return;
        const filename = id.split(/[?#]/)[0];
        const docPath = path.join(path.dirname(filename), 'Document.md');
        let doc: string | null = null;
        if (existsSync(docPath)) {
          this.addWatchFile(docPath);
          doc = marked.parse(readFileSync(docPath, 'utf-8'), { async: false });
        }
        return transformZukan(code, filename, doc);
      }
    },
    hotUpdate({ type, file, modules, timestamp }) {
      const { moduleGraph } = this.environment;
      let targets: Iterable<(typeof modules)[number]>;
      if (isDocument(file)) {
        const dir = path.dirname(file);
        targets = readdirSync(dir)
          .filter((name) => name.endsWith('.zukan.svelte'))
          .flatMap((name) => [...(moduleGraph.getModulesByFile(path.join(dir, name)) ?? [])]);
      } else if (type === 'update' && file.endsWith('.zukan.svelte')) {
        targets = modules;
      } else return;

      for (const mod of targets) moduleGraph.invalidateModule(mod, new Set(), timestamp, true);
      if (this.environment.config.consumer !== 'client') return;
      this.environment.hot.send({ type: 'full-reload' });
      return [];
    }
  };
}
