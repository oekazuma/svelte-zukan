import { marked } from 'marked';
import type { ZukanProp } from '../types.js';
import { parseSvelte } from './extract.js';

type Node = { type: string; start: number; end: number } & Record<string, unknown>;

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

/**
 * The props of a Svelte 5 component, read from `let { … }: Type = $props()` in its source.
 * `Type` may be a type literal, or a type alias or interface declared in the component; a type it can not see (an
 * imported one) is returned as `typeName`, and its props are only those destructured. `null` when the component
 * declares no props or can not be parsed.
 */
export function extractProps(source: string, filename: string): { props: ZukanProp[]; typeName: string | null } | null {
  const lf = source.replace(/\r\n?/g, '\n');
  let ast;
  try {
    ast = parseSvelte(lf, filename);
  } catch {
    return null;
  }
  const text = (n: Node) => lf.slice(n.start, n.end).replace(/\s+/g, ' ').trim();
  const body = [...(ast.module?.content.body ?? []), ...(ast.instance?.content.body ?? [])] as unknown as Node[];
  const declarations = body.map((n) =>
    n.type === 'ExportNamedDeclaration' && n.declaration ? (n.declaration as Node) : n
  );

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

  const members: Node[] = [];
  let typeName: string | null = null;
  const collect = (type: Node | undefined) => {
    if (!type) return;
    if (type.type === 'TSTypeLiteral') members.push(...(type.members as Node[]));
    else if (type.type === 'TSIntersectionType') (type.types as Node[]).forEach(collect);
    else if (type.type === 'TSTypeReference' && (type.typeName as Node).type === 'Identifier') {
      const name = (type.typeName as Node).name as string;
      const local = declarations.find(
        (d) =>
          (d.type === 'TSTypeAliasDeclaration' || d.type === 'TSInterfaceDeclaration') && (d.id as Node).name === name
      );
      if (local?.type === 'TSTypeAliasDeclaration') collect(local.typeAnnotation as Node);
      else if (local) {
        members.push(...((local.body as Node).body as Node[]));
        for (const h of (local.extends as Node[] | undefined) ?? [])
          collect({ ...h, type: 'TSTypeReference', typeName: h.expression });
      } else typeName ??= text(type);
    }
  };
  collect((id.typeAnnotation as Node | undefined)?.typeAnnotation as Node | undefined);

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
      defaults.set(keyName(p.key as Node), { value: right ? text(right) : null, bindable });
    }

  const props: ZukanProp[] = [];
  for (const m of members) {
    if ((m.type !== 'TSPropertySignature' && m.type !== 'TSMethodSignature') || m.computed) continue;
    const name = keyName(m.key as Node);
    const d = defaults.get(name);
    defaults.delete(name);
    const annotation = (m.typeAnnotation as Node | undefined)?.typeAnnotation as Node | undefined;
    props.push({
      name,
      type: m.type === 'TSMethodSignature' ? text(m).replace(/[;,]$/, '') : annotation ? text(annotation) : null,
      default: d?.value ?? null,
      required: !m.optional && d?.value == null,
      bindable: d?.bindable ?? false,
      description: jsdocOf(m)
    });
  }
  for (const [name, d] of defaults)
    props.push({ name, type: null, default: d.value, required: false, bindable: d.bindable, description: null });
  return { props, typeName };
}
