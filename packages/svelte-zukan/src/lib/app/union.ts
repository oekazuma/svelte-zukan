/**
 * the members of a union at its top level: never inside brackets, a string or a function's return type, as in
 * `(a: 'x' | 'y') => 'a' | 'b'`
 */
export function unionMembers(type: string) {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < type.length; i++) {
    const c = type[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === "'" || c === '"' || c === '`') quote = c;
    // a function type's return type runs to the end, its unions included
    else if (depth === 0 && type.startsWith('=>', i)) break;
    else if ('([{<'.includes(c)) depth++;
    // the `>` of an `=>` inside brackets closes nothing
    else if (')]}'.includes(c) || (c === '>' && type[i - 1] !== '=')) depth--;
    else if (depth === 0 && type.startsWith(' | ', i)) {
      parts.push(type.slice(start, i));
      start = i + 3;
      i += 2;
    }
  }
  parts.push(type.slice(start));
  return parts;
}
