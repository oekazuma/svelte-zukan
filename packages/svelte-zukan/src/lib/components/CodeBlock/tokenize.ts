type Kind = 'comment' | 'string' | 'tag' | 'attr' | 'keyword' | 'block' | 'op';
/** the end of the token that starts at `i`, or -1 */
type Rule = (code: string, i: number) => number;

const KEYWORDS =
  /\b(?:import|from|export|default|const|let|var|function|return|if|else|for|of|in|new|type|interface|class|extends|async|await|true|false|null|undefined)\b/y;

const sticky =
  (re: RegExp): Rule =>
  (code, i) => {
    re.lastIndex = i;
    return re.test(code) ? re.lastIndex : -1;
  };

/** a regex cannot pair the backticks of a template nested in another one's `${}` */
const template: Rule = (code, i) => {
  if (code[i] !== '`') return -1;
  for (let j = i + 1; j < code.length; j++) {
    if (code[j] === '\\') j++;
    else if (code[j] === '`') return j + 1;
    else if (code.startsWith('${', j)) {
      let depth = 0;
      for (j += 2; j < code.length && (code[j] !== '}' || depth > 0); j++) {
        if (code[j] === '{') depth++;
        else if (code[j] === '}') depth--;
        else if (code[j] === '`') {
          const end = template(code, j);
          if (end === -1) return -1;
          j = end - 1;
        }
      }
    }
  }
  return -1;
};

// first match wins at each position
const RULES: [Rule, Kind][] = [
  // `//` right after anything but a space is a URL (`https://`) or part of a regex, not a comment
  [sticky(/<!--[\s\S]*?-->|(?<!\S)\/\/[^\n]*|\/\*[\s\S]*?\*\//y), 'comment'],
  // an apostrophe after a letter is one in text (`Don't`), which would otherwise open a string up to the next one
  [sticky(/"(?:[^"\\\n]|\\.)*"|(?<!\w)'(?:[^'\\\n]|\\.)*'/y), 'string'],
  [template, 'string'],
  // before tags, so the `>` of an arrow or a comparison is not taken for the end of a tag
  [sticky(/=>|[<>]=/y), 'op'],
  [sticky(/<\/?[A-Za-z][\w.:-]*|\/?>/y), 'tag'],
  [sticky(/\{[#:/@][a-z]+\}?/y), 'block'],
  [sticky(/(?<=\s)[a-z][\w:|-]*(?==)/iy), 'attr'],
  [sticky(KEYWORDS), 'keyword']
];

/** a rough tokenizer for Svelte markup, HTML, JS and TS: enough for colour, not a parser */
export function highlight(code: string): { text: string; kind: Kind | null }[] {
  const parts: { text: string; kind: Kind | null }[] = [];
  /** where the text no rule matched starts; it becomes one part */
  let plain = 0;
  for (let i = 0; i < code.length;) {
    let end = -1;
    const rule = RULES.find(([match]) => (end = match(code, i)) > i);
    if (rule) {
      if (plain < i) parts.push({ text: code.slice(plain, i), kind: null });
      parts.push({ text: code.slice(i, end), kind: rule[1] });
      i = plain = end;
    }
    // skip a whole word, so that keywords are only found at word starts
    else i = /\w/.test(code[i]) ? code.slice(i).match(/^\w+/)![0].length + i : i + 1;
  }
  if (plain < code.length) parts.push({ text: code.slice(plain), kind: null });
  return parts;
}
