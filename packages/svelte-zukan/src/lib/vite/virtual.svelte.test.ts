import { afterEach, describe, expect, it } from 'vitest';
import { RELOAD_ON_PRELOAD_ERROR } from './virtual.js';

afterEach(() => {
  sessionStorage.clear();
  document.querySelectorAll('iframe').forEach((f) => f.remove());
});

/** a page of its own: reloading the test page would end the run */
async function page() {
  const frame = document.createElement('iframe');
  const loaded = () => new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  const first = loaded();
  frame.srcdoc = '<p>page</p>';
  document.body.append(frame);
  await first;
  const script = frame.contentDocument!.createElement('script');
  script.textContent = RELOAD_ON_PRELOAD_ERROR;
  frame.contentDocument!.head.append(script);
  const fire = () => frame.contentWindow!.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
  return { fire, loaded };
}

describe('the preload error listener', () => {
  it('reloads the page and takes over the error only then', async () => {
    const { fire, loaded } = await page();
    const reloaded = loaded();
    expect(fire()).toBe(false);
    await reloaded;
    expect(Number(sessionStorage.getItem('svelte-zukan:reloaded'))).toBeGreaterThan(Date.now() - 10000);
  });

  it('leaves the error to the page when it reloaded a moment ago', async () => {
    sessionStorage.setItem('svelte-zukan:reloaded', String(Date.now()));
    const { fire } = await page();
    expect(fire()).toBe(true);
  });
});
