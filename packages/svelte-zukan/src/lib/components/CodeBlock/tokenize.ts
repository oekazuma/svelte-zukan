export type Kind = 'comment' | 'string' | 'tag' | 'attr' | 'keyword' | 'block' | 'op';
export type Token = { start: number; end: number; kind: Kind };

const KEYWORDS =
  /\b(?:import|from|export|default|const|let|var|function|return|if|else|for|of|in|new|type|interface|class|extends|async|await|true|false|null|undefined)\b/y;

// first match wins at each position
const RULES: [RegExp, Kind][] = [
  [/<!--[\s\S]*?-->|\/\/[^\n]*|\/\*[\s\S]*?\*\//y, 'comment'],
  [/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/y, 'string'],
  // before tags, so the `>` of an arrow or a comparison is not taken for the end of a tag
  [/=>|[<>]=/y, 'op'],
  [/<\/?[A-Za-z][\w.:-]*|\/?>/y, 'tag'],
  [/\{[#:/@][a-z]+\}?/y, 'block'],
  [/(?<=\s)[a-z][\w:|-]*(?==)/iy, 'attr'],
  [KEYWORDS, 'keyword']
];

/** a rough tokenizer for Svelte markup, HTML, JS and TS: enough for colour, not a parser */
export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  for (let i = 0; i < code.length;) {
    let matched = false;
    for (const [re, kind] of RULES) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m[0].length) {
        tokens.push({ start: i, end: i + m[0].length, kind });
        i += m[0].length;
        matched = true;
        break;
      }
    }
    // skip a whole word, so that keywords are only found at word starts
    if (!matched) i = /\w/.test(code[i]) ? code.slice(i).match(/^\w+/)![0].length + i : i + 1;
  }
  return tokens;
}

/** the code split into plain and coloured parts, covering every character once */
export function highlight(code: string): { text: string; kind: Kind | null }[] {
  const parts: { text: string; kind: Kind | null }[] = [];
  let at = 0;
  for (const token of tokenize(code)) {
    if (token.start > at) parts.push({ text: code.slice(at, token.start), kind: null });
    parts.push({ text: code.slice(token.start, token.end), kind: token.kind });
    at = token.end;
  }
  if (at < code.length) parts.push({ text: code.slice(at), kind: null });
  return parts;
}
