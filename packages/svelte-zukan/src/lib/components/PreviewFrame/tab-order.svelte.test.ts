import { afterEach, expect, it } from 'vitest';
import { tabOrder } from './tab-order.js';

const root = document.createElement('div');

afterEach(() => root.remove());

const order = (html: string) => {
  root.innerHTML = html;
  document.body.append(root);
  return tabOrder(root).map((el) => el.id);
};

it('puts a positive tabindex first, by its value, then the rest in document order', () => {
  expect(
    order(`<a id="a" href="#">a</a><button id="b">b</button><div id="c" tabindex="2">c</div>
      <span id="d" tabindex="1">d</span><input id="e" /><a id="f">no href</a>
      <div id="g" contenteditable>g</div><div id="h" contenteditable tabindex="-1">h</div>`)
  ).toEqual(['d', 'c', 'a', 'b', 'e', 'g']);
});

it('leaves out what the Tab key skips', () => {
  expect(
    order(`<button id="a" disabled>a</button><input id="b" type="hidden" /><div id="c" tabindex="-1">c</div>
      <div inert><button id="d">d</button></div><div hidden><button id="e">e</button></div>
      <button id="f" style="visibility: hidden">f</button><fieldset disabled><input id="g" /></fieldset>
      <button id="h">h</button>`)
  ).toEqual(['h']);
});

it('stops once in a radio group: at its checked radio, or else at its first', () => {
  expect(
    order(`<input id="a" type="radio" name="x" /><input id="b" type="radio" name="x" checked />
      <input id="c" type="radio" name="y" /><input id="d" type="radio" name="y" />
      <input id="e" type="radio" />`)
  ).toEqual(['b', 'c', 'e']);
});
