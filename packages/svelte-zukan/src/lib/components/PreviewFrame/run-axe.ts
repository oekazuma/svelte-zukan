export type Impact = 'critical' | 'serious' | 'moderate' | 'minor';
export type Violation = { id: string; impact: Impact | null; help: string; helpUrl: string; targets: string[] };
/** `review` is what axe-core could not decide on its own, such as the contrast of text over an image or a gradient */
export type AxeResult = { violations: Violation[]; review: Violation[] };

type AxeRule = {
  id: string;
  impact?: Impact | null;
  help: string;
  helpUrl: string;
  nodes: { target: unknown[] }[];
};

type AxeWindow = Window & {
  axe?: {
    run(context: Element, options: object): Promise<{ violations: AxeRule[]; incomplete?: AxeRule[] }>;
  };
};

/** a target goes into a shadow root at each of these; axe-core gives such a path as a nested list of selectors */
const SHADOW = ' >>> ';

const toViolation = (v: AxeRule): Violation => ({
  id: v.id,
  impact: v.impact ?? null,
  help: v.help,
  helpUrl: v.helpUrl,
  targets: v.nodes.map((n) => n.target.flat().join(SHADOW))
});

/** The element a target of `runAxe` names, the document or shadow root it is in, and its selector there; null when it is gone, behind a closed shadow root, or not found because an attribute value in its selector contains ` >>> `. */
export function findTarget(doc: Document, target: string) {
  let root: Document | ShadowRoot = doc;
  const selectors = target.split(SHADOW);
  for (const [i, selector] of selectors.entries()) {
    let el: Element | null;
    try {
      el = root.querySelector(selector);
    } catch {
      // a split inside an attribute value leaves an invalid selector
      return null;
    }
    if (!el) return null;
    if (i === selectors.length - 1) return { el, root, selector };
    if (!el.shadowRoot) return null;
    root = el.shadowRoot;
  }
  return null;
}

/** the last run in each preview page: axe-core throws "Axe is already running" when a run starts before it ends */
const runs = new WeakMap<Window, Promise<unknown>>();

/** Runs axe-core inside a preview page, or throws the preview's own error when it failed to load, injecting its source on the first run. A run waits for the one before it in the same page. */
export function runAxe(doc: Document, source: () => Promise<string>): Promise<AxeResult> {
  const win = doc.defaultView!;
  const run = (runs.get(win) ?? Promise.resolve()).catch(() => {}).then(() => runOnce(doc, source));
  runs.set(win, run);
  return run;
}

async function runOnce(doc: Document, source: () => Promise<string>): Promise<AxeResult> {
  const failed = doc.querySelector('[data-zukan-error]');
  if (failed) throw new Error(failed.textContent ?? '');
  const win = doc.defaultView as AxeWindow;
  if (!win.axe) {
    const script = doc.createElement('script');
    script.textContent = await source();
    doc.head.append(script);
  }
  // `region` asks for landmarks around all content, which a component on its own never has
  const found = await win.axe!.run(doc.querySelector('[data-zukan-preview]') ?? doc.body, {
    resultTypes: ['violations', 'incomplete'],
    rules: { region: { enabled: false } }
  });
  return { violations: found.violations.map(toViolation), review: (found.incomplete ?? []).map(toViolation) };
}

/** An error thrown by axe comes from the preview page's realm, so `instanceof Error` does not see it. */
export const messageOf = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e));
