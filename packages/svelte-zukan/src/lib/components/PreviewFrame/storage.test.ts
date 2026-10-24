import { expect, it } from 'vitest';
import { transparent } from './storage.js';

it('treats every color with a zero alpha as transparent, and no opaque one', () => {
  for (const color of ['transparent', 'rgba(0, 0, 0, 0)', 'rgba(255, 255, 255, 0)', 'oklch(0.9 0.1 200 / 0)'])
    expect(transparent(color), color).toBe(true);
  for (const color of ['rgb(255, 255, 0)', 'rgb(0, 0, 0)', 'rgba(255, 255, 255, 0.5)', 'oklch(0.9 0.1 200)'])
    expect(transparent(color), color).toBe(false);
});
