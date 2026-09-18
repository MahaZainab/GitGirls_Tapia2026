import { describe, expect, it } from 'vitest';
import { findGraphProblems, orderNodes } from '../graph';
import { clipToShape, computeLayout, wrapText } from '../layout';
import { buildTextVersion, describeGraph } from '../textModel';
import { cloneFlow, iamFlow } from './fixtures';

describe('text version', () => {
  const items = buildTextVersion(iamFlow);

  it('lists every node, 7 for iam-01', () => {
    expect(items).toHaveLength(7);
  });

  it('phrases decision branches as "If <label>, go to <target>"', () => {
    const n2 = items.find((i) => i.nodeId === 'N2')!;
    expect(n2.label).toBe('Explicit deny in any policy?');
    const text = n2.branches.map((b) => b.text);
    expect(text).toContain('If yes, go to Denied');
    expect(text).toContain('If no, go to Explicit allow in a policy?');
  });

  it('marks implied edges', () => {
    const n3 = items.find((i) => i.nodeId === 'N3')!;
    const implied = n3.branches.find((b) => b.edgeId === 'E4')!;
    expect(implied.implied).toBe(true);
    expect(implied.text).toMatch(/\(implied\)$/);
    expect(n3.branches.find((b) => b.edgeId === 'E5')!.text).not.toMatch(/implied/);
  });

  it('starts at the start node, puts notes last, and orders nodes before their successors', () => {
    expect(items[0].nodeId).toBe('N1');
    expect(items[items.length - 1].nodeId).toBe('N7');
    const order = orderNodes(iamFlow).map((n) => n.id);
    for (const e of iamFlow.edges) expect(order.indexOf(e.from)).toBeLessThan(order.indexOf(e.to));
  });

  it('conveys tone in text, not only color', () => {
    expect(items.find((i) => i.nodeId === 'N5')!.toneText).toBe('positive outcome');
    expect(items.find((i) => i.nodeId === 'N6')!.toneText).toBe('negative outcome');
  });

  it('summarises the graph for the SVG label', () => {
    expect(describeGraph(iamFlow)).toContain('How a request is evaluated');
    expect(describeGraph(iamFlow)).toContain('3 decisions');
  });
});

describe('graph problems', () => {
  it('accepts the fixture', () => {
    expect(findGraphProblems(iamFlow)).toEqual([]);
  });
  it('rejects unknown edge targets, self loops and duplicate ids', () => {
    const g = cloneFlow();
    g.edges[0].to = 'N99';
    g.edges[3].to = g.edges[3].from;
    g.nodes[1].id = 'N1';
    const problems = findGraphProblems(g).join(' ');
    expect(problems).toMatch(/Node id N1 appears more than once/);
    expect(problems).toMatch(/does not exist/);
    expect(problems).toMatch(/loops back/);
  });
});

describe('layout', () => {
  const layout = computeLayout(iamFlow);

  it('positions every node and routes every edge, top to bottom', () => {
    expect(layout.nodes).toHaveLength(7);
    expect(layout.edges).toHaveLength(7);
    for (const n of layout.nodes) expect(Number.isFinite(n.x + n.y)).toBe(true);
    for (const e of layout.edges) expect(e.points.length).toBeGreaterThanOrEqual(2);
    const y = (id: string) => layout.nodes.find((n) => n.id === id)!.y;
    expect(y('N1')).toBeLessThan(y('N2'));
    expect(y('N2')).toBeLessThan(y('N3'));
  });

  it('gives labelled edges a label box', () => {
    expect(layout.edges.find((e) => e.id === 'E2')!.labelBox).toBeDefined();
    expect(layout.edges.find((e) => e.id === 'E1')!.labelBox).toBeUndefined();
  });

  it('marks tone with a glyph on the first line', () => {
    expect(layout.nodes.find((n) => n.id === 'N5')!.lines[0]).toMatch(/^✓ /);
    expect(layout.nodes.find((n) => n.id === 'N6')!.lines[0]).toMatch(/^✕ /);
  });

  it('clips edge ends to a diamond outline, not its bounding box', () => {
    const diamond = { kind: 'decision' as const, x: 0, y: 0, width: 200, height: 100 };
    const p = clipToShape(diamond, { x: 100, y: 50 });
    expect(Math.abs(p.x) / 100 + Math.abs(p.y) / 50).toBeCloseTo(1);
  });

  it('wraps long labels', () => {
    expect(wrapText('one two three four five six seven eight nine', 100).length).toBeGreaterThan(1);
  });

  it('lays out 60 nodes quickly (F2-R11)', () => {
    const g = cloneFlow();
    g.nodes = Array.from({ length: 60 }, (_, i) => ({
      id: `N${i + 1}`,
      kind: i === 0 ? 'terminal_start' : i === 59 ? 'terminal_end' : 'process',
      label: `Step number ${i + 1} of the process`,
      tone: 'neutral',
      claim_ids: ['C1'],
    }));
    g.edges = Array.from({ length: 59 }, (_, i) => ({
      id: `E${i + 1}`, from: `N${i + 1}`, to: `N${i + 2}`, claim_ids: ['C1'], basis: 'stated' as const,
    }));
    const t0 = performance.now();
    computeLayout(g);
    expect(performance.now() - t0).toBeLessThan(300);
  });
});
