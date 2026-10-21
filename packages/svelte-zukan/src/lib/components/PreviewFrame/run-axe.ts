export type Impact = 'critical' | 'serious' | 'moderate' | 'minor';
export type Violation = { id: string; impact: Impact | null; help: string; helpUrl: string; targets: string[] };

type AxeWindow = Window & {
  axe?: {
    run(
      context: Element,
      options: object
    ): Promise<{
      violations: {
        id: string;
        impact?: Impact | null;
        help: string;
        helpUrl: string;
        nodes: { target: unknown[] }[];
      }[];
    }>;
  };
};

/** Runs axe-core inside a preview page, injecting its source on the first run, and returns the violations. */
export async function runAxe(doc: Document, source: () => Promise<string>): Promise<Violation[]> {
  const win = doc.defaultView as AxeWindow;
  if (!win.axe) {
    const script = doc.createElement('script');
    script.textContent = await source();
    doc.head.append(script);
  }
  // `region` asks for landmarks around all content, which a component on its own never has
  const found = await win.axe!.run(doc.querySelector('[data-zukan-preview]') ?? doc.body, {
    resultTypes: ['violations'],
    rules: { region: { enabled: false } }
  });
  return found.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? null,
    help: v.help,
    helpUrl: v.helpUrl,
    targets: v.nodes.map((n) => n.target.join(' '))
  }));
}

/** An error thrown by axe comes from the preview page's realm, so `instanceof Error` does not see it. */
export const messageOf = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e));
