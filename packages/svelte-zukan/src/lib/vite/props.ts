import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { marked } from 'marked';
import { normalizePath } from 'vite';
import type { ZukanProp } from '../types.js';
import { parseSvelte } from './extract.js';

type Node = { type: string; start: number; end: number } & Record<string, unknown>;

/** the declarations and imports of one file, with its source for slicing text */
type Scope = {
  file: string;
  text: (n: Node) => string;
  declarations: Node[];
  imports: Map<string, { from: string; name: string }>;
};

const keyName = (key: Node) => (key.type === 'Identifier' ? (key.name as string) : String(key.value));

/** the text of a `/** … *\/` comment without its stars, up to the first block tag */
function jsdocOf(node: Node) {
  const comment = (node.leadingComments as { type: string; value: string }[] | undefined)
    ?.filter((c) => c.type === 'Block' && c.value.startsWith('*'))
    .at(-1);
  if (!comment) return null;
  const lines = comment.value
    .slice(1)
    .split('\n')
    .map((l) => l.replace(/^\s*\* ?/, '').trimEnd());
  const tag = lines.findIndex((l) => l.trimStart().startsWith('@'));
  const text = (tag === -1 ? lines : lines.slice(0, tag)).join('\n').trim();
  return text ? marked.parseInline(text, { async: false }) : null;
}

function scopeOf(file: string, lf: string, body: Node[]): Scope {
  const imports = new Map<string, { from: string; name: string }>();
  for (const n of body) {
    if (n.type !== 'ImportDeclaration') continue;
    for (const s of n.specifiers as { type: string; imported?: Node; local: Node }[])
      if (s.type === 'ImportSpecifier' && s.imported)
        imports.set(s.local.name as string, {
          from: (n.source as { value: string }).value,
          name: keyName(s.imported)
        });
  }
  return {
    file,
    text: (n) => lf.slice(n.start, n.end).replace(/\s+/g, ' ').trim(),
    declarations: body.map((n) => (n.type === 'ExportNamedDeclaration' && n.declaration ? (n.declaration as Node) : n)),
    imports
  };
}

const isFile = (file: string) => existsSync(file) && statSync(file).isFile();

/** what `import … from './types'` points to, the way TypeScript with a bundler resolves a relative path */
function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return null;
  const base = resolve(dirname(from), spec);
  const stem = base.replace(/\.js$/, '');
  for (const c of [base, `${stem}.ts`, `${stem}.d.ts`, `${base}.ts`, `${base}.d.ts`, `${base}/index.ts`])
    if (/\.(ts|svelte)$/.test(c) && isFile(c)) return normalizePath(c);
  return null;
}

/** a `.ts` file parses as the module script of a component, which allows its exports */
function readScope(file: string): Scope | null {
  const source = readFileSync(file, 'utf-8').replace(/\r\n?/g, '\n');
  const lf = file.endsWith('.svelte') ? source : `<script module lang="ts">\n${source}\n</script>`;
  try {
    const ast = parseSvelte(lf, file);
    return scopeOf(file, lf, [
      ...(ast.module?.content.body ?? []),
      ...(ast.instance?.content.body ?? [])
    ] as unknown as Node[]);
  } catch {
    return null;
  }
}

/** imports are followed this many files deep */
const MAX_DEPTH = 3;

/**
 * The props of a Svelte 5 component, read from `let { … }: Type = $props()` in its source.
 * `Type` may be a type literal, a type alias or interface declared in the component, or one imported from a relative
 * path (`./types`, `./types.js`, `../types/index.ts`, or another component's `<script module>`). A type it can not
 * read, such as one from a package, is returned as `typeName`, and its props are only those destructured. `files`
 * are the other files read, so that a change to them can refresh the props. `null` when the component declares no
 * props or can not be parsed.
 */
export function extractProps(
  source: string,
  filename: string
): { props: ZukanProp[]; typeName: string | null; files: string[] } | null {
  const lf = source.replace(/\r\n?/g, '\n');
  let ast;
  try {
    ast = parseSvelte(lf, filename);
  } catch {
    return null;
  }
  const own = scopeOf(normalizePath(filename), lf, [
    ...(ast.module?.content.body ?? []),
    ...(ast.instance?.content.body ?? [])
  ] as unknown as Node[]);

  const declarator = ((ast.instance?.content.body ?? []) as unknown as Node[])
    .filter((n) => n.type === 'VariableDeclaration')
    .flatMap((n) => n.declarations as Node[])
    .find((d) => {
      const init = d.init as Node | null;
      return (
        init?.type === 'CallExpression' &&
        (init.callee as Node).type === 'Identifier' &&
        (init.callee as Node).name === '$props'
      );
    });
  if (!declarator) return null;
  const id = declarator.id as Node;

  const members: { node: Node; scope: Scope }[] = [];
  const files = new Set<string>();
  const scopes = new Map<string, Scope | null>();
  let typeName: string | null = null;

  const declared = (scope: Scope, name: string) =>
    scope.declarations.find(
      (d) =>
        (d.type === 'TSTypeAliasDeclaration' || d.type === 'TSInterfaceDeclaration') && (d.id as Node).name === name
    );

  /** the declaration a name refers to in a scope: its own, or one it imports from a relative path */
  function lookup(scope: Scope, name: string, depth: number): { node: Node; scope: Scope; depth: number } | null {
    const local = declared(scope, name);
    if (local) return { node: local, scope, depth };
    const imported = scope.imports.get(name);
    if (!imported || depth >= MAX_DEPTH) return null;
    const file = resolveImport(scope.file, imported.from);
    if (!file) return null;
    if (!scopes.has(file)) scopes.set(file, readScope(file));
    const target = scopes.get(file);
    if (!target) return null;
    files.add(file);
    return lookup(target, imported.name, depth + 1);
  }

  /** `depth` counts the files followed to reach `scope`; `seen` stops types that refer to themselves */
  const seen = new Set<Node>();
  function collect(type: Node | undefined, scope: Scope, depth: number) {
    if (!type) return;
    if (type.type === 'TSTypeLiteral') members.push(...(type.members as Node[]).map((node) => ({ node, scope })));
    else if (type.type === 'TSIntersectionType') for (const t of type.types as Node[]) collect(t, scope, depth);
    else if (type.type === 'TSTypeReference' && (type.typeName as Node).type === 'Identifier') {
      const found = lookup(scope, (type.typeName as Node).name as string, depth);
      if (!found) typeName ??= scope.text(type);
      else if (seen.has(found.node)) return;
      else if (found.node.type === 'TSTypeAliasDeclaration') {
        seen.add(found.node);
        collect(found.node.typeAnnotation as Node, found.scope, found.depth);
      } else {
        seen.add(found.node);
        members.push(...((found.node.body as Node).body as Node[]).map((node) => ({ node, scope: found.scope })));
        for (const h of (found.node.extends as Node[] | undefined) ?? [])
          collect({ ...h, type: 'TSTypeReference', typeName: h.expression }, found.scope, found.depth);
      }
    }
  }
  collect((id.typeAnnotation as Node | undefined)?.typeAnnotation as Node | undefined, own, 0);

  const defaults = new Map<string, { value: string | null; bindable: boolean }>();
  if (id.type === 'ObjectPattern')
    for (const p of id.properties as Node[]) {
      if (p.type !== 'Property') continue;
      const value = p.value as Node;
      let right = value.type === 'AssignmentPattern' ? (value.right as Node) : null;
      const bindable =
        right?.type === 'CallExpression' &&
        (right.callee as Node).type === 'Identifier' &&
        (right.callee as Node).name === '$bindable';
      if (bindable) right = ((right!.arguments as Node[])[0] as Node | undefined) ?? null;
      defaults.set(keyName(p.key as Node), { value: right ? own.text(right) : null, bindable });
    }

  const props: ZukanProp[] = [];
  for (const { node: m, scope } of members) {
    if ((m.type !== 'TSPropertySignature' && m.type !== 'TSMethodSignature') || m.computed) continue;
    const name = keyName(m.key as Node);
    const d = defaults.get(name);
    defaults.delete(name);
    const annotation = (m.typeAnnotation as Node | undefined)?.typeAnnotation as Node | undefined;
    props.push({
      name,
      type:
        m.type === 'TSMethodSignature'
          ? scope.text(m).replace(/[;,]$/, '')
          : annotation
            ? scope.text(annotation)
            : null,
      default: d?.value ?? null,
      required: !m.optional && d?.value == null,
      bindable: d?.bindable ?? false,
      description: jsdocOf(m)
    });
  }
  for (const [name, d] of defaults)
    props.push({ name, type: null, default: d.value, required: false, bindable: d.bindable, description: null });
  return { props, typeName, files: [...files] };
}
