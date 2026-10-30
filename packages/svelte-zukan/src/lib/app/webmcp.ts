import { messageOf, runAxe } from '../components/PreviewFrame/run-axe.js';
import type { Theme } from '../components/PreviewFrame/storage.js';
import { CATEGORIES } from '../vite/tailwind-tokens.js';
import type { TailwindSource } from '../types.js';
import { formatHash } from './hash.js';
import { filterTokens, filterVariables } from './tailwind-filter.js';

/**
 * WebMCP: tools an agent driving the browser can call on the catalog page instead of reading the screen. Browsers
 * without a model context ignore them. The shapes follow what browsers have shipped so far: `provideContext({ tools })`
 * or one `registerTool` per tool, on `navigator.modelContext` or `document.modelContext`.
 */

type Result = { content: { type: 'text'; text: string }[]; isError?: boolean };
type Args = Record<string, unknown>;

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, object>; required?: string[] };
  annotations: { readOnlyHint: boolean; openWorldHint: boolean };
  execute: (input: Args) => Promise<Result>;
};

export type ModelContext = {
  provideContext?: (context: { tools: WebMcpTool[] }) => void;
  registerTool?: (tool: WebMcpTool) => void;
};

type CatalogJson = {
  components: { id: string; name: string; group: string; doc: string | null; sections: { title: string }[] }[];
  uncataloged: unknown[];
  tailwind?: Omit<TailwindSource, 'id' | 'css'>[] | null;
};

const text = (value: unknown, isError = false): Result => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
  ...(isError && { isError: true })
});

// WebMCP does not promise that arguments match the schema
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : undefined);
const theme = (v: unknown): Theme | undefined => (v === 'light' || v === 'dark' ? v : undefined);

const ID = { type: 'string', description: 'A component ID from list_components, such as "ui/Button"' };
const SECTION = { type: 'string', description: 'A section title of that component' };
const WIDTH = { type: 'integer', description: 'The preview width in CSS pixels' };
const THEME = { type: 'string', enum: ['light', 'dark'] };

/** `catalog.json`, or the error the dev server answers with when the catalog can not be listed (a duplicate ID) */
export async function fetchCatalog(url: URL): Promise<CatalogJson> {
  const res = await fetch(url);
  if (res.ok) return res.json();
  const data: { error?: unknown } | null = await res.json().catch(() => null);
  throw new Error(typeof data?.error === 'string' ? data.error : res.statusText);
}

export function buildTools(opts: {
  /** `catalog.json` next to the catalog page */
  fetchCatalog: () => Promise<CatalogJson>;
  /** the source of axe-core */
  axe?: () => Promise<string>;
  /** the catalog page's path, for preview URLs */
  page: string;
  /** false when the `theme` option fixes the theme: the tools then take no `theme` */
  themes?: boolean;
  /** the catalog's current theme, for a check that names none: the preview's own default is the OS's */
  currentTheme?: () => Theme;
  /** whether the catalog has Tailwind CSS data */
  tailwind?: boolean;
  /** goes to a hash route; the catalog page's own also brings a section it already shows into view */
  open?: (hash: string) => void;
}): WebMcpTool[] {
  const open = opts.open ?? ((hash: string) => (location.hash = hash));
  const withTheme: Record<string, object> = opts.themes === false ? {} : { theme: THEME };
  const find = async (id: string | undefined) => (await opts.fetchCatalog()).components.find((c) => c.id === id);
  const tools: WebMcpTool[] = [
    {
      name: 'list_components',
      description:
        'Lists the components in this Svelte component catalog: ID, name, group, section titles, and the first line of each description. Also lists .svelte files that have no catalog file yet.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true, openWorldHint: false },
      async execute() {
        const data = await opts.fetchCatalog();
        return text({
          components: data.components.map((c) => ({
            id: c.id,
            name: c.name,
            group: c.group,
            sections: c.sections.map((s) => s.title),
            description:
              c.doc
                ?.split('\n')
                .find((l) => l.trim() && !l.startsWith('#'))
                ?.trim() ?? null
          })),
          uncataloged: data.uncataloged
        });
      }
    },
    {
      name: 'get_component',
      description:
        "Returns one component of the catalog: its files, its Markdown description, its props, and each section's code and preview URL.",
      inputSchema: { type: 'object', properties: { id: ID }, required: ['id'] },
      annotations: { readOnlyHint: true, openWorldHint: false },
      async execute(input) {
        const found = await find(str(input.id));
        return found ? text(found) : text(`No component with the ID "${String(input.id)}".`, true);
      }
    },
    {
      name: 'open_component',
      description: `Shows a component's page in the catalog, optionally scrolled to a section and with that section's preview at a width${opts.themes === false ? '' : ' and in a theme'}.`,
      inputSchema: {
        type: 'object',
        properties: { id: ID, section: SECTION, width: WIDTH, ...withTheme },
        required: ['id']
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
      async execute(input) {
        const id = str(input.id);
        const component = await find(id);
        if (!component) return text(`No component with the ID "${String(input.id)}".`, true);
        if (input.section != null && !component.sections.some((s) => s.title === input.section))
          return text(`No section "${String(input.section)}" in "${String(input.id)}".`, true);
        open(
          formatHash('detail', id!, str(input.section), {
            width: num(input.width),
            theme: theme(input.theme)
          })
        );
        return text(`Opened ${id}.`);
      }
    }
  ];
  if (opts.axe) {
    const axe = opts.axe;
    tools.push({
      name: 'check_accessibility',
      description:
        "Runs axe-core on one section of a component, rendered on its own. Returns `violations` and `review` (what axe-core could not decide on its own, such as the contrast of text over an image, to check by other means), each a list of rules with their impact, help text and the elements' selectors (`host >>> inner` for an element inside a shadow root). Two empty lists mean axe-core found nothing.",
      inputSchema: {
        type: 'object',
        properties: { id: ID, section: SECTION, width: { ...WIDTH, default: 1280 }, ...withTheme },
        required: ['id', 'section']
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      async execute(input) {
        const id = str(input.id);
        const section = str(input.section);
        const component = await find(id);
        if (!component || !component.sections.some((s) => s.title === section))
          return text(`No section "${String(input.section)}" in "${String(input.id)}".`, true);
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.tabIndex = -1;
        frame.style.cssText = `position:fixed;left:-100000px;top:0;width:${num(input.width) ?? 1280}px;height:800px;border:0`;
        frame.src =
          opts.page + formatHash('preview', id!, section, { theme: theme(input.theme) ?? opts.currentTheme?.() });
        try {
          await new Promise((resolve) => {
            frame.addEventListener('load', resolve, { once: true });
            document.body.append(frame);
          });
          const doc = frame.contentDocument!;
          // the preview mounts the component after the page's load event
          for (let i = 0; i < 50 && !doc.querySelector('[data-zukan-ready], [data-zukan-error]'); i++)
            await new Promise((r) => setTimeout(r, 100));
          return text(await runAxe(doc, axe));
        } catch (e) {
          return text(`The check could not run: ${messageOf(e)}`, true);
        } finally {
          frame.remove();
        }
      }
    });
  }
  if (opts.tailwind) {
    tools.push({
      name: 'list_tailwind_tokens',
      description:
        "Lists the Tailwind CSS v4 tokens of this project's CSS entries: the utility classes, theme variables and values that exist. Without a category it returns each entry's categories and their token counts; with one, that category's tokens (`tokens`), or with \"full-config\" every theme variable (`variables`). Use only the classes listed here.",
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: [...CATEGORIES.map((c) => c.id), 'full-config'],
            description: '"full-config" returns every theme variable of the entry, as `variables`'
          },
          query: {
            type: 'string',
            description: 'Keeps the tokens whose class, CSS variable or value contains this text'
          }
        }
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
      async execute(input) {
        const category = str(input.category);
        if (category && category !== 'full-config' && !CATEGORIES.some((c) => c.id === category))
          return text(`No category "${category}". Call without a category to list them.`, true);
        const query = str(input.query) ?? '';
        const entries = (await opts.fetchCatalog()).tailwind ?? [];
        return text(
          entries.map(({ file, prefix, categories, variables, error }) => {
            const err = error !== undefined && { error };
            if (!category)
              return {
                file,
                prefix,
                ...err,
                categories: categories.map((c) => ({ id: c.id, title: c.title, count: c.tokens.length }))
              };
            if (category === 'full-config')
              return { file, ...err, variables: Object.fromEntries(filterVariables(variables, query)) };
            return {
              file,
              ...err,
              tokens: filterTokens(categories.find((c) => c.id === category)?.tokens ?? [], query)
            };
          })
        );
      }
    });
  }
  // a rejection would reach the agent as whatever the browser makes of it, without the message
  return tools.map((tool) => ({
    ...tool,
    execute: (input) => tool.execute(input).catch((e: unknown) => text(messageOf(e), true))
  }));
}

/** Whether the browser took the tools: false wherever WebMCP is not implemented, which is the usual case. */
export function registerTools(tools: WebMcpTool[], context: ModelContext | null | undefined): boolean {
  if (typeof context?.provideContext === 'function') {
    context.provideContext({ tools });
    return true;
  }
  if (typeof context?.registerTool === 'function') {
    for (const tool of tools) context.registerTool(tool);
    return true;
  }
  return false;
}
