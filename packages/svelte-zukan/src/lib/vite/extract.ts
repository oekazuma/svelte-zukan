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

/** the names a pattern declares: `x`, `{ a, b: [c] }`, `d = 1`, `...e` */
function patternNames(p: Node | null | undefined, names: string[] = []) {
  if (!p) return names;
  if (p.type === 'Identifier') names.push(p.name as string);
  else if (p.type === 'ObjectPattern')
    for (const prop of p.properties as Node[])
      patternNames((prop.type === 'Property' ? prop.value : prop.argument) as Node, names);
  else if (p.type === 'ArrayPattern') for (const e of p.elements as (Node | null)[]) patternNames(e, names);
  else if (p.type === 'AssignmentPattern') patternNames(p.left as Node, names);
  else if (p.type === 'RestElement') patternNames(p.argument as Node, names);
  return names;
}

function declaredNames(node: Node) {
  if (node.type === 'ImportDeclaration')
    return (node.specifiers as { local: Node }[]).flatMap((s) => patternNames(s.local));
  if (node.type === 'VariableDeclaration')
    return (node.declarations as { id: Node }[]).flatMap((d) => patternNames(d.id));
  return patternNames(node.id as Node);
}

/** the names `node` declares for what is under its `key` */
function namesFor(node: Node, key: string): string[] {
  switch (node.type) {
    case 'EachBlock':
      // `{:else}` does not see the item
      return key === 'expression' || key === 'fallback'
        ? []
        : patternNames(node.context as Node, node.index ? [node.index as string] : []);
    case 'AwaitBlock':
      return key === 'value' || key === 'then'
        ? patternNames(node.value as Node)
        : key === 'error' || key === 'catch'
          ? patternNames(node.error as Node)
          : [];
    case 'SnippetBlock':
      return key === 'expression' ? [] : (node.parameters as Node[]).flatMap((p) => patternNames(p));
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
    case 'FunctionDeclaration':
      return (node.params as Node[]).flatMap((p) => patternNames(p));
    case 'CatchClause':
      return patternNames(node.param as Node);
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement': {
      const head = (node.init ?? node.left) as Node | null;
      return head?.type === 'VariableDeclaration' ? declaredNames(head) : [];
    }
  }
  // `let:item` and `let:item={alias}` of an element or a component
  return ((node.attributes as Node[] | undefined) ?? []).flatMap((a) =>
    a.type === 'LetDirective' ? (a.expression ? patternNames(a.expression as Node) : [a.name as string]) : []
  );
}

/**
 * The variables `value` reads. A name the template or a function declares (an `{#each}` item, a snippet parameter,
 * `{@const}`) hides a script variable of the same name under it.
 */
function identifiersOf(value: unknown, hidden: ReadonlySet<string> = new Set(), names = new Set<string>()) {
  if (Array.isArray(value)) {
    // `{@const}` and a declaration in a block are seen by everything next to them
    const local = (value as (Node | null)[]).flatMap((n) =>
      n?.type === 'ConstTag'
        ? declaredNames(n.declaration as Node)
        : n && ['VariableDeclaration', 'FunctionDeclaration', 'ClassDeclaration'].includes(n.type)
          ? declaredNames(n)
          : []
    );
    const inner = local.length ? new Set([...hidden, ...local]) : hidden;
    for (const v of value) identifiersOf(v, inner, names);
    return names;
  }
  if (!value || typeof value !== 'object') return names;
  const n = value as Node;
  const add = (name: string) => {
    if (!hidden.has(name)) names.add(name);
  };
  if (n.type === 'Identifier') add(n.name as string);
  else if (['Component', 'UseDirective', 'TransitionDirective', 'AnimateDirective'].includes(n.type))
    add((n.name as string).split('.')[0]);
  // `style:color` alone reads the variable `color`
  else if (n.type === 'StyleDirective' && n.value === true) add(n.name as string);
  for (const [key, child] of Object.entries(n)) {
    if (key === 'metadata' || key === 'parent') continue;
    // `obj.label` and `{ label: 1 }` name no variable
    if (key === 'property' && n.type === 'MemberExpression' && !n.computed) continue;
    if (
      key === 'key' &&
      ['Property', 'MethodDefinition', 'PropertyDefinition', 'TSPropertySignature', 'TSMethodSignature'].includes(
        n.type
      ) &&
      !n.computed &&
      !n.shorthand
    )
      continue;
    const local = typeof n.type === 'string' ? namesFor(n, key) : [];
    identifiersOf(child, local.length ? new Set([...hidden, ...local]) : hidden, names);
  }
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
 * `parse` drops a leading byte order mark, so the source it reports offsets into has none. Windows checkouts are often
 * CRLF; the code view joins its parts with \n.
 */
export const normalizeSource = (source: string) => source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

/**
 * Runs before vite-plugin-svelte preprocesses the file, so a `<style>` that does not parse as CSS (e.g. SCSS) is
 * retried with its contents blanked out. Same length, newlines kept: offsets and line numbers still point into
 * `source`. Comments and `<script>` are matched in the same pass and left alone, so a `<style>` written inside them
 * does not start a style block. Only a retry, because the regex would also pair a `<style>` in an attribute or an
 * expression with the file's real `</style>`.
 */
export function parseSvelte(source: string, filename: string): Ast {
  try {
    return parse(source, { modern: true, filename });
  } catch {
    return parse(
      source.replace(
        /<!--[\s\S]*?-->|<script(?=[\s/>])[^>]*>[\s\S]*?<\/script\s*>|(<style(?=[\s/>])[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
        (match, open?: string, css?: string, close?: string) =>
          open === undefined ? match : open + css!.replace(/[^\r\n]/g, ' ') + close
      ),
      { modern: true, filename }
    );
  }
}

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
  const lf = normalizeSource(source);
  return sectionsFrom(parseZukan(lf, filename), lf, filename);
}
