import { afterEach, describe, expect, it, vi } from 'vitest';
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
