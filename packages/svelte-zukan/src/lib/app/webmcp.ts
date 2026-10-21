import { messageOf, runAxe } from '../components/PreviewFrame/run-axe.js';
import type { Theme } from '../components/PreviewFrame/storage.js';
import { formatHash } from './hash.js';

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

export function buildTools(opts: {
  /** `catalog.json` next to the catalog page */
  fetchCatalog: () => Promise<CatalogJson>;
  /** the source of axe-core */
  axe?: () => Promise<string>;
  /** the catalog page's path, for preview URLs */
  page: string;
  /** false when the `theme` option fixes the theme: the tools then take no `theme` */
  themes?: boolean;
}): WebMcpTool[] {
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
        if (!(await find(id))) return text(`No component with the ID "${String(input.id)}".`, true);
        location.hash = formatHash('detail', id!, str(input.section), {
          width: num(input.width),
          theme: theme(input.theme)
        });
        return text(`Opened ${id}.`);
      }
    }
  ];
  if (opts.axe) {
    const axe = opts.axe;
    tools.push({
      name: 'check_accessibility',
      description:
        "Runs axe-core on one section of a component, rendered on its own, and returns the violations: rule, impact, help text and the elements' selectors. An empty list means axe-core found nothing.",
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
        frame.src = opts.page + formatHash('preview', id!, section, { theme: theme(input.theme) });
        try {
          await new Promise((resolve) => {
            frame.addEventListener('load', resolve, { once: true });
            document.body.append(frame);
          });
          const doc = frame.contentDocument!;
          // the preview mounts the component after the page's load event
          for (let i = 0; i < 50 && !doc.querySelector('[data-zukan-preview] *'); i++)
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
  return tools;
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
