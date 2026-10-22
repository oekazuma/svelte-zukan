import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TailwindSource } from '../types.js';
import { buildTools, registerTools, type WebMcpTool } from './webmcp.js';

const catalog = {
  components: [
    {
      id: 'ui/Button',
      name: 'Button',
      group: 'ui',
      doc: '# Button\n\nThe main action.\n\nMore.',
      sections: [{ title: 'Primary' }, { title: 'Disabled' }]
    }
  ],
  uncataloged: [{ group: 'ui', file: 'src/lib/Lone.svelte' }]
};

const tool = (tools: WebMcpTool[], name: string) => tools.find((t) => t.name === name)!;
const body = (r: { content: { text: string }[] }) => r.content[0].text;

afterEach(() => history.replaceState(null, '', location.pathname + location.search));

describe('WebMCP tools', () => {
  const tools = buildTools({ fetchCatalog: () => Promise.resolve(catalog), page: '/__zukan/' });

  it('lists the components with their sections and first line', async () => {
    const out = JSON.parse(body(await tool(tools, 'list_components').execute({})));
    expect(out).toEqual({
      components: [
        {
          id: 'ui/Button',
          name: 'Button',
          group: 'ui',
          sections: ['Primary', 'Disabled'],
          description: 'The main action.'
        }
      ],
      uncataloged: [{ group: 'ui', file: 'src/lib/Lone.svelte' }]
    });
  });

  it('returns one component, and an error for an unknown ID', async () => {
    expect(JSON.parse(body(await tool(tools, 'get_component').execute({ id: 'ui/Button' }))).name).toBe('Button');
    const missing = await tool(tools, 'get_component').execute({ id: 'ui/Nope' });
    expect(missing.isError).toBe(true);
    expect((await tool(tools, 'get_component').execute({ id: 42 })).isError).toBe(true);
  });

  it('opens a section at a width and theme by setting the catalog hash', async () => {
    await tool(tools, 'open_component').execute({ id: 'ui/Button', section: 'Primary', width: 375, theme: 'dark' });
    expect(location.hash).toBe('#/ui/Button?section=Primary&width=375&theme=dark');
    // values outside the schema are dropped rather than written into the URL
    await tool(tools, 'open_component').execute({ id: 'ui/Button', width: -1, theme: 'blue' });
    expect(location.hash).toBe('#/ui/Button');
  });

  it('has no accessibility tool without axe-core, and marks what only reads', () => {
    expect(tools.map((t) => t.name)).toEqual(['list_components', 'get_component', 'open_component']);
    expect(tools.map((t) => t.annotations.readOnlyHint)).toEqual([true, true, false]);
  });

  it('takes no theme when the catalog has only one', () => {
    const fixed = buildTools({
      fetchCatalog: () => Promise.resolve(catalog),
      page: '/',
      axe: () => Promise.resolve(''),
      themes: false
    });
    for (const name of ['open_component', 'check_accessibility'])
      expect(Object.keys(tool(fixed, name).inputSchema.properties)).not.toContain('theme');
    expect(tool(fixed, 'open_component').description).not.toContain('theme');
  });

  it('refuses a section the component does not have, before rendering anything', async () => {
    const withAxe = buildTools({
      fetchCatalog: () => Promise.resolve(catalog),
      page: '/',
      axe: () => Promise.resolve('')
    });
    const result = await tool(withAxe, 'check_accessibility').execute({ id: 'ui/Button', section: 'Nope' });
    expect(result.isError).toBe(true);
    expect(document.querySelectorAll('iframe').length).toBe(0);
  });

  describe('check_accessibility', () => {
    // a blob: page is same-origin, so the tool can reach into it as it does into a preview
    const check = async (preview: string) => {
      const page = URL.createObjectURL(new Blob([preview], { type: 'text/html' }));
      const withAxe = buildTools({
        fetchCatalog: () => Promise.resolve(catalog),
        page,
        axe: () =>
          Promise.resolve(`window.axe = { run: async () => ({ violations: [{ id: 'image-alt', impact: 'critical',
            help: 'Images must have alternative text', helpUrl: 'https://example.com/image-alt',
            nodes: [{ target: ['img'] }] }] }) };`)
      });
      try {
        return await tool(withAxe, 'check_accessibility').execute({ id: 'ui/Button', section: 'Primary' });
      } finally {
        URL.revokeObjectURL(page);
      }
    };

    it('renders the section and returns what axe-core finds', async () => {
      const result = await check('<div data-zukan-preview><img src=""></div>');
      expect(result.isError).toBeUndefined();
      expect(JSON.parse(body(result))).toEqual([
        {
          id: 'image-alt',
          impact: 'critical',
          help: 'Images must have alternative text',
          helpUrl: 'https://example.com/image-alt',
          targets: ['img']
        }
      ]);
      expect(document.querySelectorAll('iframe').length).toBe(0);
    });

    it('reports a preview that failed to load instead of checking its error message', async () => {
      const result = await check('<div data-zukan-preview><p data-zukan-error>Failed to load: boom</p></div>');
      expect(result.isError).toBe(true);
      expect(body(result)).toBe('The check could not run: Failed to load: boom');
    });
  });
});

describe('list_tailwind_tokens', () => {
  const tailwind: Omit<TailwindSource, 'id' | 'css'>[] = [
    {
      file: 'src/app.css',
      version: '4.3.3',
      prefix: null,
      categories: [
        {
          id: 'background-color',
          title: 'Background Color',
          tokens: [
            { class: 'bg-brand-500', cssVariable: '--color-brand-500', value: '#ff3e00' },
            { class: 'bg-sky-500', cssVariable: '--color-sky-500', value: '#00a6f4' }
          ]
        },
        {
          id: 'padding',
          title: 'Padding',
          tokens: [{ class: 'p-4', cssVariable: null, value: 'calc(var(--spacing) * 4)' }]
        }
      ],
      variables: { '--color-brand-500': '#ff3e00', '--font-sans': 'Inter' }
    },
    { file: 'docs/app.css', version: '4.3.3', prefix: 'tw', categories: [], variables: {}, error: 'broken' }
  ];
  const tools = buildTools({
    fetchCatalog: () => Promise.resolve({ ...catalog, tailwind }),
    page: '/',
    tailwind: true
  });
  const run = async (input: Record<string, unknown>) => {
    const result = await tool(tools, 'list_tailwind_tokens').execute(input);
    return { ...result, json: result.isError ? null : JSON.parse(body(result)) };
  };

  it('registers only with Tailwind data', () => {
    expect(tools.map((t) => t.name)).toContain('list_tailwind_tokens');
    expect(tool(tools, 'list_tailwind_tokens').annotations.readOnlyHint).toBe(true);
    const without = buildTools({ fetchCatalog: () => Promise.resolve(catalog), page: '/' });
    expect(without.map((t) => t.name)).not.toContain('list_tailwind_tokens');
  });

  it('summarizes categories without a category', async () => {
    expect((await run({})).json).toEqual([
      {
        file: 'src/app.css',
        prefix: null,
        categories: [
          { id: 'background-color', title: 'Background Color', count: 2 },
          { id: 'padding', title: 'Padding', count: 1 }
        ]
      },
      { file: 'docs/app.css', prefix: 'tw', error: 'broken', categories: [] }
    ]);
  });

  it('returns the filtered tokens of a category', async () => {
    expect((await run({ category: 'background-color', query: ' SKY ' })).json).toEqual([
      { file: 'src/app.css', tokens: [{ class: 'bg-sky-500', cssVariable: '--color-sky-500', value: '#00a6f4' }] },
      { file: 'docs/app.css', error: 'broken', tokens: [] }
    ]);
    // a value matches too, and Full config lists the theme variables
    expect((await run({ category: 'background-color', query: 'ff3e' })).json[0].tokens).toHaveLength(1);
    expect((await run({ category: 'full-config', query: 'font' })).json[0].variables).toEqual({
      '--font-sans': 'Inter'
    });
  });

  it('answers an unknown category with an error result', async () => {
    const result = await run({ category: 'nope' });
    expect(result.isError).toBe(true);
    expect(body(result)).toContain('nope');
  });
});

describe('registerTools', () => {
  const tools = buildTools({ fetchCatalog: () => Promise.resolve(catalog), page: '/' });

  it('uses provideContext when the browser has it, else registerTool, else nothing', () => {
    const provideContext = vi.fn();
    expect(registerTools(tools, { provideContext })).toBe(true);
    expect(provideContext).toHaveBeenCalledWith({ tools });
    const registerTool = vi.fn();
    expect(registerTools(tools, { registerTool })).toBe(true);
    expect(registerTool).toHaveBeenCalledTimes(tools.length);
    expect(registerTools(tools, undefined)).toBe(false);
    expect(registerTools(tools, {})).toBe(false);
  });
});
