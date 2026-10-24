import { expect, it } from 'vitest';
import { fitThumb } from './thumb-fit.js';

it('shows a small example at its real size, in the middle', () => {
  // 80 × 20 at (24, 24) in a 250 × 150 thumbnail
  expect(fitThumb({ left: 24, top: 24, width: 80, height: 20 }, 250, 150)).toEqual({ scale: 1, x: 61, y: 41 });
});

it('scales a wide example down to the width and keeps it in the middle', () => {
  const fit = fitThumb({ left: 24, top: 24, width: 432, height: 40 }, 250, 150);
  expect(fit.scale).toBeCloseTo(218 / 432);
  // centred: the content's middle lands on the thumbnail's middle
  expect((fit.x + 24 + 216) * fit.scale).toBeCloseTo(125);
  expect((fit.y + 24 + 20) * fit.scale).toBeCloseTo(75);
});

it('starts a tall example at the top once it is at the smallest scale', () => {
  const fit = fitThumb({ left: 24, top: 24, width: 432, height: 1000 }, 250, 150);
  expect(fit.scale).toBe(0.3);
  expect((fit.y + 24) * fit.scale).toBeCloseTo(16);
});
