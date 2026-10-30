import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Marked } from 'marked';
import { normalizePath } from 'vite';
import type { ZukanProp } from '../types.js';
import { normalizeSource, parseSvelte } from './extract.js';
import { findPackage } from './tailwind-load.js';

type Node = { type: string; start: number; end: number } & Record<string, unknown>;

/** the declarations and imports of one file, with its source for slicing text */
type Scope = {
  file: string;
  text: (n: Node) => string;
  declarations: Node[];
  /** imported names */
  imports: Map<string, { from: string; name: string }>;
  /** the names a barrel re-exports (`export type { Props } from './button'`) */
  reexports: Map<string, { from: string; name: string }>;
  /** the file's own exports, exported name to local name (`export type Props`, `export { Inner as Props }`) */
  exported: Map<string, string>;
  /** the sources of `export * from './button'` */
  stars: string[];
  /** a file of a package, reached through a bare import such as `svelte/elements` */
  package: boolean;
};

const keyName = (key: Node) => (key.type === 'Identifier' ? (key.name as string) : String(key.value));

// Markdown, but HTML as text, as an editor shows it: an installed package's comment would otherwise render as markup
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const jsdoc = new Marked({
  renderer: { html: ({ text }) => escapeHtml(text) },
  // marked takes the text after `<pre>`, `<code>` or `<script>` as already escaped, as in a raw HTML block
  walkTokens: (t) => {
    if (t.type === 'text') t.escaped = false;
  }
});

/**
 * `{@link Foo}`, `{@link Foo text}`, `{@link Foo|text}`, as an editor shows them: a web URL as a link, anything else
 * as a name, so a `javascript:` target never becomes a link
 */
const resolveLinks = (text: string) =>
  text.replace(/\{@link(code|plain)?\s+([^\s|}]+)(?:\s*\|\s*|\s+)?([^}]*)\}/g, (_, kind, target, label) => {
    label = label.trim();
    if (/^https?:\/\//i.test(target)) return `[${label || target}](${target})`;
    if (label) return kind === 'code' ? `\`${label}\`` : label;
    return kind === 'plain' ? target : `\`${target}\``;
  });

/** the text of a `/** … *\/` comment without its stars, up to the first block tag */
function jsdocOf(node: Node) {
  const comment = (node.leadingComments as { type: string; value: string }[] | undefined)
    ?.filter((c) => c.type === 'Block' && c.value.startsWith('*'))
    .at(-1);
  if (!comment) return null;
  const lines = comment.value
    .slice(1)
    .split('\n')
    // the first line follows `/**` directly, so a `*` there is text (`/** **bold** */`)
    .map((l, i) => (i ? l.replace(/^\s*\* ?/, '') : l).trimEnd());
  const tag = lines.findIndex((l) => l.trimStart().startsWith('@'));
  const text = (tag === -1 ? lines : lines.slice(0, tag)).join('\n').trim();
  return text ? jsdoc.parseInline(resolveLinks(text), { async: false }) : null;
}

function scopeOf(file: string, lf: string, body: Node[], pkg = false): Scope {
  const imports = new Map<string, { from: string; name: string }>();
  const reexports = new Map<string, { from: string; name: string }>();
  const exported = new Map<string, string>();
  const stars: string[] = [];
  for (const n of body) {
    const from = (n.source as { value: string } | null | undefined)?.value;
    const declaration = n.declaration as Node | null | undefined;
    if (n.type === 'ExportNamedDeclaration') {
      const id = declaration?.id as Node | undefined;
      if (id?.type === 'Identifier') exported.set(id.name as string, id.name as string);
      for (const s of n.specifiers as { local: Node; exported: Node }[])
        if (from === undefined) exported.set(keyName(s.exported), keyName(s.local));
        else reexports.set(keyName(s.exported), { from, name: keyName(s.local) });
    } else if (n.type === 'ExportDefaultDeclaration')
      if (declaration?.type === 'Identifier') exported.set('default', declaration.name as string);
      else if (declaration?.type === 'TSInterfaceDeclaration')
        exported.set('default', (declaration.id as Node).name as string);
    if (from === undefined) continue;
    if (n.type === 'ImportDeclaration') {
      for (const s of n.specifiers as { type: string; imported?: Node; local: Node }[])
        if (s.type === 'ImportSpecifier' && s.imported)
          imports.set(s.local.name as string, { from, name: keyName(s.imported) });
        else if (s.type === 'ImportDefaultSpecifier') imports.set(s.local.name as string, { from, name: 'default' });
        else if (s.type === 'ImportNamespaceSpecifier') imports.set(s.local.name as string, { from, name: '*' });
    } else if (n.type === 'ExportAllDeclaration' && !n.exported) stars.push(from);
  }
  return {
    file,
    // a string keeps its spaces; a `//` comment would swallow what follows once the lines are joined
    text: (n) =>
      lf
        .slice(n.start, n.end)
        .replace(/(['"`])(?:\\[\s\S]|(?!\1)[^\\])*\1|(?:\s|\/\/.*|\/\*[\s\S]*?\*\/)+/g, (m, quote) => (quote ? m : ' '))
        .trim(),
    declarations: body.map((n) =>
      (n.type === 'ExportNamedDeclaration' || n.type === 'ExportDefaultDeclaration') && n.declaration
        ? (n.declaration as Node)
        : n
    ),
    imports,
    reexports,
    exported,
    stars,
    package: pkg
  };
}

/** `let { … }: Props = $props()` */
function isProps(declarator: Node) {
  const init = declarator.init as Node | null | undefined;
  return (
    init?.type === 'CallExpression' &&
    (init.callee as Node).type === 'Identifier' &&
    (init.callee as Node).name === '$props'
  );
}

/** the keys of `'a' | 'b'`, or null when it is anything else */
function literalKeys(type: Node | undefined): string[] | null {
  if (type?.type === 'TSLiteralType') {
    const value = (type.literal as Node).value;
    return typeof value === 'string' ? [value] : null;
  }
  if (type?.type !== 'TSUnionType') return null;
  const keys = (type.types as Node[]).map(literalKeys);
  return keys.every((k) => k !== null) ? (keys as string[][]).flat() : null;
}

const isFile = (file: string) => existsSync(file) && statSync(file).isFile();

const isRelative = (spec: string) => spec.startsWith('./') || spec.startsWith('../');

/** `./props.mjs` is declared by `./props.mts` or `./props.d.mts`, as TypeScript resolves it */
function declarationsOf(file: string): string[] {
  const js = file.match(/^(.*)\.([cm]?)js$/);
  if (js) return [`${js[1]}.${js[2]}ts`, `${js[1]}.d.${js[2]}ts`];
  return /\.[cm]?ts$/.test(file) ? [file] : [];
}

/** the files `./types` may point to, in the order TypeScript with a bundler tries them */
function filesOf(base: string): string[] {
  // svelte-package publishes a component's types as `Button.svelte.d.ts`, next to a `Button.svelte` without them
  const declared = base.endsWith('.svelte')
    ? [`${base}.ts`, `${base}.d.ts`, base]
    : /\.[cm]?[jt]s$/.test(base)
      ? declarationsOf(base)
      : [`${base}.ts`, `${base}.d.ts`, `${base}/index.ts`, `${base}/index.d.ts`];
  return declared.map(normalizePath);
}

/**
 * the files that may declare a bare import: the `types` condition of the package's `exports`, its `types`, the
 * declaration next to its `main`, or those of `@types/<name>` when the package has none of its own
 */
function packageCandidates(from: string, spec: string): string[] {
  const [, name, sub = ''] = spec.match(/^((?:@[^/]+\/)?[^/]+)(\/.+)?$/) ?? [];
  if (!name) return [];
  const dir = findPackage(name, dirname(from));
  const own = dir ? entryOf(dir, sub) : [];
  if (own.some(isFile) || name.startsWith('@types/')) return own;
  const typed = packageCandidates(from, `@types/${name.replace(/^@([^/]+)\//, '$1__')}${sub}`);
  return typed.some(isFile) ? typed : own;
}

function entryOf(dir: string, sub: string): string[] {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
  } catch {
    return [];
  }
  const exports = manifest.exports;
  // a string, or only conditions, is the root entry
  const map =
    typeof exports === 'string' ||
    (exports && typeof exports === 'object' && !Object.keys(exports).some((k) => k.startsWith('.')))
      ? { '.': exports }
      : exports;
  const path = `.${sub}`;
  let entry = map && typeof map === 'object' ? map[path] : undefined;
  let star: string | null = null;
  // a pattern such as `./*`: the longest prefix that matches wins, as in Node
  if (entry === undefined && map && typeof map === 'object')
    for (const key of Object.keys(map).sort((a, b) => b.indexOf('*') - a.indexOf('*'))) {
      const [prefix, suffix] = key.split('*');
      if (suffix === undefined || !path.startsWith(prefix) || !path.endsWith(suffix)) continue;
      if (path.length < prefix.length + suffix.length) continue;
      entry = map[key];
      star = path.slice(prefix.length, path.length - suffix.length);
      break;
    }
  while (entry && typeof entry === 'object') entry = entry.types ?? entry.import ?? entry.default;
  if (typeof entry === 'string' && star !== null) entry = entry.replaceAll('*', star);
  if (entry === undefined && !exports)
    entry = sub ? path : (manifest.types ?? manifest.typings ?? manifest.main ?? 'index');
  // a workspace package often points at its source `.ts` rather than a built `.d.ts`
  return typeof entry === 'string' ? filesOf(resolve(dir, entry)) : [];
}

/** the files `import … from './types'` may point to */
const candidatesOf = (from: string, spec: string) =>
  isRelative(spec) ? filesOf(resolve(dirname(from), spec)) : packageCandidates(from, spec);

/** a `.ts` file parses as the module script of a component, which allows its exports */
function readScope(file: string, pkg: boolean): Scope | null {
  const source = normalizeSource(readFileSync(file, 'utf-8'));
  const wrap = (s: string) => `<script module lang="ts">\n${s}\n</script>`;
  const lf = file.endsWith('.svelte') ? source : wrap(source);
  try {
    // a `</script` in a comment or a string would end the wrapping script early; a slash of the same length (U+2215)
    // keeps the offsets, so the types are still sliced from the file as written
    const ast = parseSvelte(file.endsWith('.svelte') ? lf : wrap(source.replace(/<\/(?=script)/gi, '<\u2215')), file);
    return scopeOf(
      file,
      lf,
      [...(ast.module?.content.body ?? []), ...(ast.instance?.content.body ?? [])] as unknown as Node[],
      pkg
    );
  } catch {
    return null;
  }
}

/**
 * Installed package files by path, across calls: a declaration file such as `svelte/elements` is large, and every
 * component typed with it reads it. They do not change while the dev server runs; an upgrade means a restart.
 */
const packageScopes = new Map<string, Scope | null>();

/** imports are followed this many files deep */
const MAX_DEPTH = 3;

/**
 * The props of a Svelte 5 component, read from `let { … }: Type = $props()` in its source.
 * `Type` may be a type literal, a type alias or interface declared in the component, or one imported from a relative
 * path (`./types`, `./types.js`, `../types/index.ts`, or another component's `<script module>`). A type from a
 * package (`svelte/elements`) is named in `typeName`, and of its members only the destructured ones are listed,
 * typed from the package's declaration file when it has one; a type it can not read at all is named the same way.
 * `typeName` joins the names with commas.
 * `files` are the other files read, so that a change to them can refresh the props. `null` when the component
 * declares no props or can not be parsed.
 */
export function extractProps(
  source: string,
  filename: string
): { props: ZukanProp[]; typeName: string | null; files: string[] } | null {
  const lf = normalizeSource(source);
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
    .find(isProps);
  if (!declarator) return null;
  const id = declarator.id as Node;

  const members: { node: Node; scope: Scope }[] = [];
  const files = new Set<string>();
  const scopes = new Map<string, Scope | null>();
  /** may repeat: an `Omit` that can not be read takes back the names its type added */
  const typeNames: string[] = [];

  /** a type alias or interface, or with `value` a variable (`declare const Button: Component<…>`) */
  /** the default export of a source component is its `$props()` */
  const declared = (scope: Scope, name: string, value: boolean) =>
    value
      ? scope.declarations
          .flatMap((d) => (d.type === 'VariableDeclaration' ? (d.declarations as Node[]) : []))
          .find((d) =>
            name === 'default' && scope.file.endsWith('.svelte') ? isProps(d) : (d.id as Node).name === name
          )
      : scope.declarations.find(
          (d) =>
            (d.type === 'TSTypeAliasDeclaration' || d.type === 'TSInterfaceDeclaration') && (d.id as Node).name === name
        );

  /**
   * The declaration a name refers to in a scope: its own, or one it imports or re-exports. `via` is how the name
   * reached the scope: written in it (`local`), imported from it by its exported name (`import`), or through
   * `export *` (`star`), which passes on only what that file exports
   */
  function lookup(
    scope: Scope,
    name: string,
    depth: number,
    via: 'local' | 'import' | 'star' = 'local',
    value = false
  ): { node: Node; scope: Scope; depth: number } | null {
    const local =
      via === 'local' ? name : via === 'import' ? (scope.exported.get(name) ?? name) : scope.exported.get(name);
    const node = local === undefined ? null : declared(scope, local, value);
    if (node) return { node, scope, depth };
    if (depth >= MAX_DEPTH) return null;
    const imported = scope.reexports.get(name) ?? (local === undefined ? undefined : scope.imports.get(local));
    const next = imported ? [{ ...imported, star: false }] : scope.stars.map((from) => ({ from, name, star: true }));
    for (const { from, name: target, star } of next) {
      const candidates = candidatesOf(scope.file, from);
      const file = candidates.find(isFile);
      const pkg = scope.package || !isRelative(from);
      // a workspace package links outside `node_modules`: its files are the project's own, edited while it runs
      const installed = pkg && (file ?? candidates[0] ?? '').includes('/node_modules/');
      // even when it does not parse, or is not there yet: fixing it, or creating one that comes before it, should
      // refresh the props
      if (!installed)
        for (const c of file ? candidates.slice(0, candidates.indexOf(file) + 1) : candidates) files.add(c);
      if (!file) continue;
      const cache = installed ? packageScopes : scopes;
      if (!cache.has(file)) cache.set(file, readScope(file, pkg));
      const found = cache.get(file);
      if (!found) continue;
      const result = lookup(found, target, depth + 1, star ? 'star' : 'import', value);
      if (result) return result;
    }
    return null;
  }

  /**
   * `depth` counts the files followed to reach `scope`; `seen`, the types being read, stops types that refer to
   * themselves, and only those: a type read again elsewhere (`Omit<A, 'x'> & A`) is read again
   */
  const seen = new Set<Node>();
  /** as written in the project: what a package type refers to inside its own files is behind the name already given */
  const name = (scope: Scope, type: Node) => {
    if (!scope.package) typeNames.push(scope.text(type));
  };
  function collect(type: Node | undefined, scope: Scope, depth: number) {
    if (!type) return;
    if (type.type === 'TSParenthesizedType') collect(type.typeAnnotation as Node, scope, depth);
    else if (type.type === 'TSTypeLiteral') members.push(...(type.members as Node[]).map((node) => ({ node, scope })));
    else if (type.type === 'TSIntersectionType') for (const t of type.types as Node[]) collect(t, scope, depth);
    else if (type.type === 'TSTypeReference') {
      const typeName = type.typeName as Node;
      const ref = typeName.type === 'Identifier' ? (typeName.name as string) : null;
      const [first, second] = ((type.typeArguments as Node | undefined)?.params as Node[] | undefined) ?? [];
      const from = ref === null ? undefined : scope.imports.get(ref);
      // `ComponentProps<typeof Button>`, with `Button` a source component, or declared `Component<Props>` as
      // svelte-package writes it
      const queried = first?.type === 'TSTypeQuery' ? (first.exprName as Node) : null;
      if (from?.from === 'svelte' && from.name === 'ComponentProps' && queried?.type === 'Identifier') {
        const component = lookup(scope, queried.name as string, depth, 'local', true);
        const t = ((component?.node.id as Node | undefined)?.typeAnnotation as Node | undefined)?.typeAnnotation as
          Node | undefined;
        const callee = (t?.type === 'TSImportType' ? t.qualifier : t?.typeName) as Node | undefined;
        const props =
          component && isProps(component.node)
            ? t
            : callee?.name === 'Component'
              ? ((t!.typeArguments as Node | undefined)?.params as Node[] | undefined)?.[0]
              : undefined;
        if (component && props) {
          if (component.scope.package) name(scope, type);
          return collect(props, component.scope, component.depth);
        }
      }
      const keys =
        (ref === 'Omit' || ref === 'Pick') && !from && !declared(scope, ref, false) ? literalKeys(second) : null;
      if (keys) {
        const start = members.length;
        const named = typeNames.length;
        collect(first, scope, depth);
        // with anything under it that is not listed in full (a package type, a union), `Omit<…>` is named as written
        if (typeNames.length === named && members.slice(start).every((m) => !m.scope.package)) {
          const picked = members
            .splice(start)
            .filter((m) => (!!m.node.key && keys.includes(keyName(m.node.key as Node))) === (ref === 'Pick'));
          return void members.push(...picked);
        }
        members.length = start;
        typeNames.length = named;
      }
      // `T.Props` with `import type * as T`: looked up in a scope that imports only `Props` from that file
      const ns =
        typeName.type === 'TSQualifiedName' && (typeName.left as Node).type === 'Identifier'
          ? scope.imports.get((typeName.left as Node).name as string)
          : undefined;
      const found =
        ref !== null
          ? lookup(scope, ref, depth)
          : ns?.name === '*'
            ? lookup(
                {
                  ...scope,
                  imports: new Map([['', { from: ns.from, name: (typeName.right as Node).name as string }]])
                },
                '',
                depth
              )
            : null;
      if (!found || found.scope.package) name(scope, type);
      if (!found || seen.has(found.node)) return;
      if (found.node.type === 'TSTypeAliasDeclaration') {
        seen.add(found.node);
        collect(found.node.typeAnnotation as Node, found.scope, found.depth);
        seen.delete(found.node);
      } else {
        // the declarations of an interface declared more than once merge, all of their own members before anything
        // they extend, so that a later declaration narrowing an inherited member wins
        const merged = found.scope.declarations.filter(
          (node) => node.type === 'TSInterfaceDeclaration' && (node.id as Node).name === (found.node.id as Node).name
        );
        for (const node of merged) {
          seen.add(node);
          members.push(...((node.body as Node).body as Node[]).map((m) => ({ node: m, scope: found.scope })));
        }
        for (const node of merged)
          for (const h of (node.extends as Node[] | undefined) ?? [])
            collect(
              {
                ...h,
                type: 'TSTypeReference',
                typeName: h.expression,
                typeArguments: h.typeArguments ?? h.typeParameters
              },
              found.scope,
              found.depth
            );
        for (const node of merged) seen.delete(node);
      }
    }
    // a union and the like: the reader gets the type as written
    else name(scope, type);
  }
  collect((id.typeAnnotation as Node | undefined)?.typeAnnotation as Node | undefined, own, 0);

  /** a comment on the destructured prop describes it when its type has none, as a package's member mostly does */
  const defaults = new Map<string, { value: string | null; bindable: boolean; description: string | null }>();
  if (id.type === 'ObjectPattern')
    for (const p of id.properties as Node[]) {
      if (p.type !== 'Property' || p.computed) continue;
      const value = p.value as Node;
      let right = value.type === 'AssignmentPattern' ? (value.right as Node) : null;
      const bindable =
        right?.type === 'CallExpression' &&
        (right.callee as Node).type === 'Identifier' &&
        (right.callee as Node).name === '$bindable';
      if (bindable) right = ((right!.arguments as Node[])[0] as Node | undefined) ?? null;
      defaults.set(keyName(p.key as Node), {
        value: right ? own.text(right) : null,
        bindable,
        description: jsdocOf(p)
      });
    }

  /** `import('svelte').Snippet` reads as `Snippet` */
  const typeText = (scope: Scope, n: Node) => scope.text(n).replace(/import\((['"])[^'"]*\1\)\./g, '');
  // the component's own types first, so that they win over a package's member of the same name
  // ponytail: a package member keeps its type parameters as written (`MouseEventHandler<T>`); substitute the
  // arguments (`HTMLAttributes<HTMLButtonElement>`) if that reads badly in practice
  // a name declared again (an interface narrowing what it extends, both sides of an intersection) is listed once: the
  // first one read, an interface's own member before the one it extends
  const props: ZukanProp[] = [];
  const listed = new Set<string>();
  for (const { node: m, scope } of [
    ...members.filter((m) => !m.scope.package),
    ...members.filter((m) => m.scope.package)
  ]) {
    if ((m.type !== 'TSPropertySignature' && m.type !== 'TSMethodSignature') || m.computed) continue;
    const name = keyName(m.key as Node);
    if (listed.has(name) || (scope.package && !defaults.has(name))) continue;
    listed.add(name);
    const d = defaults.get(name);
    defaults.delete(name);
    const annotation = (m.typeAnnotation as Node | undefined)?.typeAnnotation as Node | undefined;
    props.push({
      name,
      type:
        m.type === 'TSMethodSignature'
          ? typeText(scope, m).replace(/[;,]$/, '')
          : annotation
            ? typeText(scope, annotation)
            : null,
      default: d?.value ?? null,
      required: !m.optional && d?.value == null,
      bindable: d?.bindable ?? false,
      description: jsdocOf(m) ?? d?.description ?? null
    });
  }
  for (const [name, d] of defaults)
    props.push({
      name,
      type: null,
      default: d.value,
      required: false,
      bindable: d.bindable,
      description: d.description
    });
  return { props, typeName: typeNames.length ? [...new Set(typeNames)].join(', ') : null, files: [...files] };
}
