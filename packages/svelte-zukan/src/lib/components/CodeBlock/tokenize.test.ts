import { describe, expect, it } from 'vitest';
import { highlight } from './tokenize.js';

const kinds = (code: string) =>
  highlight(code)
    .filter((p) => p.kind)
    .map((p) => `${p.kind}:${p.text}`);

describe('highlight', () => {
  it('finds tags, attributes, strings and blocks in markup', () => {
    expect(kinds('<Button variant="primary" {disabled}>Go</Button>\n{#if open}<p>a</p>{/if}')).toEqual([
      'tag:<Button',
      'attr:variant',
      'string:"primary"',
      'tag:>',
      'tag:</Button',
      'tag:>',
      'block:{#if',
      'tag:<p',
      'tag:>',
      'tag:</p',
      'tag:>',
      'block:{/if}'
    ]);
  });

  it('finds keywords, strings and comments in a script', () => {
    expect(kinds("import Button from './Button.svelte';\n// note\nlet count = $state(0);")).toEqual([
      'keyword:import',
      'keyword:from',
      "string:'./Button.svelte'",
      'comment:// note',
      'keyword:let'
    ]);
  });

  it('does not take an arrow or a comparison for a tag', () => {
    expect(kinds('<Button onclick={() => count >= 1}>x</Button>')).toEqual([
      'tag:<Button',
      'attr:onclick',
      'op:=>',
      'op:>=',
      'tag:>',
      'tag:</Button',
      'tag:>'
    ]);
  });

  it('keeps a < inside a string out of the tags, and keywords only as whole words', () => {
    expect(kinds('const label = "<b>";\nconst index = imports;')).toEqual([
      'keyword:const',
      'string:"<b>"',
      'keyword:const'
    ]);
  });

  it('starts no string at an apostrophe in text', () => {
    expect(kinds("<p>Don't <b>stop</b>, it's fine</p>")).toEqual([
      'tag:<p',
      'tag:>',
      'tag:<b',
      'tag:>',
      'tag:</b',
      'tag:>',
      'tag:</p',
      'tag:>'
    ]);
  });

  it('takes no URL or regex for a comment, only // at a line start or after a space', () => {
    expect(kinds('<a href="https://example.com">https://example.com</a>')).toEqual([
      'tag:<a',
      'attr:href',
      'string:"https://example.com"',
      'tag:>',
      'tag:</a',
      'tag:>'
    ]);
    expect(kinds('const re = /\\/\\//;\nlet a; // note')).toEqual(['keyword:const', 'keyword:let', 'comment:// note']);
  });

  it('keeps a template literal nested in another one whole', () => {
    expect(kinds('const a = `x ${`y ${z}`} w`;')).toEqual(['keyword:const', 'string:`x ${`y ${z}`} w`']);
    expect(kinds('const a = `open')).toEqual(['keyword:const']);
  });

  it('covers every character exactly once', () => {
    const code = '<script lang="ts">\n  let a = 1; // one\n</script>\n\n<p class="x">{a}</p>';
    expect(
      highlight(code)
        .map((p) => p.text)
        .join('')
    ).toBe(code);
  });
});
