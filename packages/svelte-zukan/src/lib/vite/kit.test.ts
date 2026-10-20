import { describe, expect, it } from 'vitest';
import { detectSvelteKit } from './kit.js';

describe('detectSvelteKit', () => {
  it('finds sveltekit() in nested arrays and promises', async () => {
    const setup = { name: 'vite-plugin-sveltekit-setup', api: { options: {} } };
    expect(await detectSvelteKit([{ name: 'vite-plugin-sveltekit-guard' }, Promise.resolve([setup])])).toBe(setup);
    expect(await detectSvelteKit([[{ name: 'vite-plugin-svelte' }], null, false])).toBeUndefined();
    expect(await detectSvelteKit([])).toBeUndefined();
  });
});
