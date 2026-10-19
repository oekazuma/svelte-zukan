import MagicString from 'magic-string';
import { parse, type AST } from 'svelte/compiler';
import type { ZukanMeta, ZukanSection } from '../types.js';

type Node = { type: string; start: number; end: number } & Record<string, unknown>;
type Ast = AST.Root;

const isSection = (n: Node) => n.type === 'Component' && n.name === 'Section';

function walk(value: unknown, visit: (node: Node) => void) {
  if (Array.isArray(value)) return value.forEach((v) => walk(v, visit));
  if (!value || typeof value !== 'object') return;
  if ('type' in value) visit(value as Node);
  for (const [key, child] of Object.entries(value)) {
    if (key !== 'metadata' && key !== 'parent') walk(child, visit);
  }
}

function dedent(text: string) {
  const lines = text.split('\n');
  let prefix: string | undefined;
  for (const line of lines) {
    if (!line.trim()) continue;
    const indent = line.match(/^[ \t]*/)![0];
    if (prefix === undefined) prefix = indent;
    else {
      let i = 0;
      while (i < prefix.length && prefix[i] === indent[i]) i++;
      prefix = prefix.slice(0, i);
    }
  }
  return lines.map((line) => (line.trim() ? line.slice(prefix!.length) : '')).join('\n');
}

function identifiersOf(value: unknown) {
  const names = new Set<string>();
  // `obj.label` and `{ label: 1 }` name no variable; `walk` sees a parent before its children
  const skip = new Set<unknown>();
  walk(value, (n) => {
    if (n.type === 'MemberExpression' && !n.computed) skip.add(n.property);
    else if (['Property', 'MethodDefinition', 'PropertyDefinition'].includes(n.type) && !n.computed && !n.shorthand)
      skip.add(n.key);
    else if (n.type === 'Identifier' && !skip.has(n)) names.add(n.name as string);
    else if (['Component', 'UseDirective', 'TransitionDirective', 'AnimateDirective'].includes(n.type))
      names.add((n.name as string).split('.')[0]);
  });
  return names;
}

function declaredNames(node: Node) {
  const names: string[] = [];
  const addPattern = (p: Node | null) => {
    if (!p) return;
    if (p.type === 'Identifier') names.push(p.name as string);
    else if (p.type === 'ObjectPattern')
      for (const prop of p.properties as Node[])
        addPattern((prop.type === 'Property' ? prop.value : prop.argument) as Node);
    else if (p.type === 'ArrayPattern') (p.elements as (Node | null)[]).forEach(addPattern);
    else if (p.type === 'AssignmentPattern') addPattern(p.left as Node);
    else if (p.type === 'RestElement') addPattern(p.argument as Node);
  };
  if (node.type === 'ImportDeclaration') for (const s of node.specifiers as { local: Node }[]) addPattern(s.local);
  else if (node.type === 'VariableDeclaration') for (const d of node.declarations as { id: Node }[]) addPattern(d.id);
  else addPattern(node.id as Node);
  return names;
}

function lineOf(source: string, pos: number) {
  return source.slice(0, pos).split('\n').length;
}

function sectionsFrom(ast: Ast, source: string, filename: string): ZukanSection[] {
  const fail = (pos: number, message: string): never => {
    throw new Error(`${filename}:${lineOf(source, pos)} ${message}`);
  };
  const top = (ast.fragment.nodes as unknown as Node[]).filter(isSection);
  const topSet = new Set<Node>(top);
  walk(ast.fragment.nodes, (n) => {
    if (isSection(n) && !topSet.has(n))
      fail(
        n.start,
        '<Section> must not be nested (if this is your own component named "Section", import it under another name)'
      );
  });
  if (!top.length) return [];

  const lang = (ast.instance?.attributes as Node[] | undefined)?.find((a) => a.name === 'lang');
  const langValue = (lang?.value as { data: string }[] | undefined)?.[0]?.data;
  const scriptTag = langValue ? `<script lang="${langValue}">` : '<script>';

  const defs = ((ast.instance?.content.body ?? []) as unknown as Node[])
    .filter(
      (n) =>
        (n.type === 'ImportDeclaration' && (n.source as { value: string }).value !== 'svelte-zukan') ||
        ['VariableDeclaration', 'FunctionDeclaration', 'ClassDeclaration'].includes(n.type)
    )
    .map((node) => {
      const lineStart = source.lastIndexOf('\n', node.start - 1) + 1;
      const lead = source.slice(lineStart, node.start);
      const text = dedent((lead.trim() ? '' : lead) + source.slice(node.start, node.end));
      return { names: declaredNames(node), uses: identifiersOf(node), text };
    });

  const titles = new Set<string>();
  return top.map((section) => {
    const attr = (section.attributes as Node[]).find((a) => a.name === 'title');
    const value = attr?.value as Node[] | true | undefined;
    if (!attr) fail(section.start, '<Section> needs a title');
    // `title` alone (value `true`) and `title=""` (no Text node) are both empty
    if (value === true || (Array.isArray(value) && !value.length))
      fail(section.start, '<Section> title must not be empty');
    if (!Array.isArray(value) || value.length !== 1 || value[0].type !== 'Text')
      fail(section.start, '<Section> title must be a static string');
    const title = (value as unknown as { data: string }[])[0].data;
    if (!title.trim()) fail(section.start, '<Section> title must not be empty');
    if (titles.has(title)) fail(section.start, `duplicate <Section> title "${title}"`);
    titles.add(title);

    const nodes = (section.fragment as { nodes: Node[] }).nodes;
    const body = nodes.length
      ? dedent(
          source
            .slice(nodes[0].start, nodes.at(-1)!.end)
            .replace(/^(?:[ \t]*\n)+/, '')
            .trimEnd()
        )
      : '';

    const refs = identifiersOf(nodes);
    const used = new Set<(typeof defs)[number]>();
    for (let grew = true; grew;) {
      grew = false;
      for (const def of defs) {
        if (used.has(def) || !def.names.some((n) => refs.has(n))) continue;
        used.add(def);
        def.uses.forEach((n) => refs.add(n));
        grew = true;
      }
    }
    const script = defs
      .filter((d) => used.has(d))
      .map((d) =>
        d.text
          .split('\n')
          .map((l) => (l ? `  ${l}` : l))
          .join('\n')
      );
    const code = script.length ? `${scriptTag}\n${script.join('\n')}\n</script>\n\n${body}` : body;
    return { title, code };
  });
}

/**
 * Runs before vite-plugin-svelte preprocesses the file, so the contents of `<style>` (e.g. SCSS) are blanked out first.
 * Same length, newlines kept: offsets and line numbers still point into `source`.
 */
function parseZukan(source: string, filename: string): Ast {
  // ponytail: a "<style>" inside a comment or a string is blanked too; harmless unless a "</style>" follows it
  const blanked = source.replace(
    /(<style(?=[\s/>])[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
    (_, open: string, css: string, close: string) => open + css.replace(/[^\r\n]/g, ' ') + close
  );
  try {
    return parse(blanked, { modern: true, filename });
  } catch (e) {
    throw new Error(
      `svelte-zukan: could not parse ${filename} (catalog files must be plain Svelte markup; preprocessor languages are only supported inside <style>): ${(e as Error).message}`,
      { cause: e }
    );
  }
}

export function extractSections(source: string, filename: string): ZukanSection[] {
  return sectionsFrom(parseZukan(source, filename), source, filename);
}

export function transformZukan(source: string, filename: string, doc: string | null) {
  const ast = parseZukan(source, filename);
  const meta: ZukanMeta = { sections: sectionsFrom(ast, source, filename), doc };
  // `<` is escaped so a "</script>" inside the code strings cannot end the script block
  const exported = `export const __zukan = ${JSON.stringify(meta).replace(/</g, '\\u003c')};`;
  const s = new MagicString(source);
  if (ast.module) s.appendLeft((ast.module.content as unknown as Node).start, exported);
  else s.append(`\n<script module>${exported}</script>\n`);
  return { code: s.toString(), map: s.generateMap({ hires: 'boundary', source: filename, includeContent: true }) };
}
