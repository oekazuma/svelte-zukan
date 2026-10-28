import { parse, type AST } from 'svelte/compiler';
import type { ZukanSection } from '../types.js';

type Node = { type: string; start: number; end: number } & Record<string, unknown>;
type Ast = AST.Root;

const isSection = (n: Node, name: string) => n.type === 'Component' && n.name === name;

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
    else if (
      ['Property', 'MethodDefinition', 'PropertyDefinition', 'TSPropertySignature', 'TSMethodSignature'].includes(
        n.type
      ) &&
      !n.computed &&
      !n.shorthand
    )
      skip.add(n.key);
    else if (n.type === 'Identifier' && !skip.has(n)) names.add(n.name as string);
    else if (['Component', 'UseDirective', 'TransitionDirective', 'AnimateDirective'].includes(n.type))
      names.add((n.name as string).split('.')[0]);
    // `style:color` alone reads the variable `color`
    else if (n.type === 'StyleDirective' && n.value === true) names.add(n.name as string);
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

/** `let x = $state(0)`, `$derived.by(...)`, `$props()` */
function isRuneDeclaration(node: Node) {
  if (node.type !== 'VariableDeclaration') return false;
  return (node.declarations as { init: Node | null }[]).every(({ init }) => {
    let callee = init?.type === 'CallExpression' ? (init.callee as Node) : null;
    if (callee?.type === 'MemberExpression') callee = callee.object as Node;
    return callee?.type === 'Identifier' && (callee.name as string).startsWith('$');
  });
}

// `import { Section as Example } from 'svelte-zukan'` names the tag `Example`
function sectionName(ast: Ast) {
  for (const n of [...(ast.module?.content.body ?? []), ...(ast.instance?.content.body ?? [])] as unknown as Node[]) {
    if (n.type !== 'ImportDeclaration' || (n.source as { value: string }).value !== 'svelte-zukan') continue;
    for (const s of n.specifiers as { type: string; imported?: { name?: string }; local: { name: string } }[])
      if (s.type === 'ImportSpecifier' && s.imported?.name === 'Section') return s.local.name;
  }
  return 'Section';
}

function scriptTagOf(script: { attributes: unknown[] } | null | undefined, module: boolean, source: string) {
  // as written: `generics='T extends "a"'` can not be put back in double quotes
  const attr = (name: string) => {
    const a = (script?.attributes as Node[] | undefined)?.find((a) => a.name === name);
    return a ? ` ${source.slice(a.start, a.end)}` : '';
  };
  return `<script${module ? ' module' : ''}${attr('lang')}${attr('generics')}>`;
}

function lineOf(source: string, pos: number) {
  return source.slice(0, pos).split('\n').length;
}

function sectionsFrom(ast: Ast, source: string, filename: string): ZukanSection[] {
  const fail = (pos: number, message: string): never => {
    throw new Error(`${filename}:${lineOf(source, pos)} ${message}`);
  };
  const name = sectionName(ast);
  const top = (ast.fragment.nodes as unknown as Node[]).filter((n) => isSection(n, name));
  const topSet = new Set<Node>(top);
  walk(ast.fragment.nodes, (n) => {
    if (isSection(n, name) && !topSet.has(n))
      fail(
        n.start,
        `<${name}> must not be nested (if this is your own component named "Section", import it under another name)`
      );
  });
  if (!top.length) return [];

  const textOf = (node: Node) => {
    const lineStart = source.lastIndexOf('\n', node.start - 1) + 1;
    const lead = source.slice(lineStart, node.start);
    return dedent((lead.trim() ? '' : lead) + source.slice(node.start, node.end));
  };
  const scriptDefs = (script: typeof ast.instance, kind: 'module' | 'script') =>
    ((script?.content.body ?? []) as unknown as Node[])
      .filter(
        (n) =>
          (n.type === 'ImportDeclaration' && (n.source as { value: string }).value !== 'svelte-zukan') ||
          (n.type === 'ExportNamedDeclaration' && n.declaration) ||
          [
            'VariableDeclaration',
            'FunctionDeclaration',
            'TSDeclareFunction',
            'ClassDeclaration',
            'TSTypeAliasDeclaration',
            'TSInterfaceDeclaration',
            'TSEnumDeclaration'
          ].includes(n.type)
      )
      .map((node) => ({
        kind,
        names: declaredNames((node.type === 'ExportNamedDeclaration' ? node.declaration : node) as Node),
        // as Svelte decides: `$state` is a store only when `state` is not itself declared with a rune
        store: !isRuneDeclaration((node.type === 'ExportNamedDeclaration' ? node.declaration : node) as Node),
        uses: identifiersOf(node),
        text: textOf(node)
      }));
  const snippetDefs = (ast.fragment.nodes as unknown as Node[])
    .filter((n) => n.type === 'SnippetBlock')
    .map((node) => ({
      kind: 'snippet' as const,
      names: [(node.expression as { name: string }).name],
      store: false,
      uses: identifiersOf(node),
      text: textOf(node)
    }));
  const defs = [...scriptDefs(ast.module, 'module'), ...scriptDefs(ast.instance, 'script'), ...snippetDefs];
  const moduleTag = scriptTagOf(ast.module, true, source);
  const scriptTag = scriptTagOf(ast.instance, false, source);
  const block = (tag: string, list: typeof defs) =>
    list.length
      ? `${tag}\n${list
          .map((d) =>
            d.text
              .split('\n')
              .map((l) => (l ? `  ${l}` : l))
              .join('\n')
          )
          .join('\n')}\n</script>`
      : '';

  const titles = new Set<string>();
  return top.map((section) => {
    const attr = (section.attributes as Node[]).find((a) => a.name === 'title');
    const value = attr?.value as Node[] | true | undefined;
    if (!attr) fail(section.start, `<${name}> needs a title`);
    // `title` alone (value `true`) and `title=""` (no Text node) are both empty
    if (value === true || (Array.isArray(value) && !value.length))
      fail(section.start, `<${name}> title must not be empty`);
    if (!Array.isArray(value) || value.length !== 1 || value[0].type !== 'Text')
      fail(section.start, `<${name}> title must be a static string`);
    const title = (value as unknown as { data: string }[])[0].data;
    if (!title.trim()) fail(section.start, `<${name}> title must not be empty`);
    if (titles.has(title)) fail(section.start, `duplicate <${name}> title "${title}"`);
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
        if (used.has(def) || !def.names.some((n) => refs.has(n) || (def.store && refs.has('$' + n)))) continue;
        used.add(def);
        def.uses.forEach((n) => refs.add(n));
        grew = true;
      }
    }
    const usedOf = (kind: (typeof defs)[number]['kind']) => defs.filter((d) => d.kind === kind && used.has(d));
    const snippets = usedOf('snippet').map((d) => d.text);
    const code = [block(moduleTag, usedOf('module')), block(scriptTag, usedOf('script')), ...snippets, body]
      .filter(Boolean)
      .join('\n\n');
    return { title, code };
  });
}

/**
 * Runs before vite-plugin-svelte preprocesses the file, so the contents of `<style>` (e.g. SCSS) are blanked out first.
 * Same length, newlines kept: offsets and line numbers still point into `source`. Comments and `<script>` are matched
 * in the same pass and left alone, so a `<style>` written inside them does not start a style block.
 */
export const parseSvelte = (source: string, filename: string): Ast =>
  parse(
    source.replace(
      /<!--[\s\S]*?-->|<script(?=[\s/>])[^>]*>[\s\S]*?<\/script\s*>|(<style(?=[\s/>])[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
      (match, open?: string, css?: string, close?: string) =>
        open === undefined ? match : open + css!.replace(/[^\r\n]/g, ' ') + close
    ),
    { modern: true, filename }
  );

function parseZukan(source: string, filename: string): Ast {
  try {
    return parseSvelte(source, filename);
  } catch (e) {
    throw new Error(
      `svelte-zukan: could not parse ${filename} (catalog files must be plain Svelte markup; preprocessor languages are only supported inside <style>): ${(e as Error).message}`,
      { cause: e }
    );
  }
}

export function extractSections(source: string, filename: string): ZukanSection[] {
  // Windows checkouts are often CRLF; the code view joins its parts with \n
  const lf = source.replace(/\r\n?/g, '\n');
  return sectionsFrom(parseZukan(lf, filename), lf, filename);
}
