type Kind = 'comment' | 'string' | 'tag' | 'attr' | 'keyword' | 'block' | 'op';

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
export function highlight(code: string): { text: string; kind: Kind | null }[] {
  const parts: { text: string; kind: Kind | null }[] = [];
  /** where the text no rule matched starts; it becomes one part */
  let plain = 0;
  for (let i = 0; i < code.length;) {
    const rule = RULES.find(([re]) => {
      re.lastIndex = i;
      return re.test(code) && re.lastIndex > i;
    });
    if (rule) {
      if (plain < i) parts.push({ text: code.slice(plain, i), kind: null });
      parts.push({ text: code.slice(i, rule[0].lastIndex), kind: rule[1] });
      i = plain = rule[0].lastIndex;
    }
    // skip a whole word, so that keywords are only found at word starts
    else i = /\w/.test(code[i]) ? code.slice(i).match(/^\w+/)![0].length + i : i + 1;
  }
  if (plain < code.length) parts.push({ text: code.slice(plain), kind: null });
  return parts;
}
