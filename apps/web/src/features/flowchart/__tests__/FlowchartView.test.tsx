import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlowchartView } from '../FlowchartView';
import { MotionPolicyProvider } from '@studyshift/ui-tokens';
import { apiClient } from '../../../shared/apiClient';
import { eventBus } from '../../../shared/eventBus';
import * as layoutModule from '../layout';
import { cloneFlow, iamClaims, iamFlow } from './fixtures';

interface Seen {
  type: string;
  payload: Record<string, unknown>;
}
let events: Seen[] = [];
let unsubscribe: Array<() => void> = [];

beforeEach(() => {
  events = [];
  unsubscribe = (['anchor.reveal', 'flow.node.selected'] as const).map((type) =>
    eventBus.on(type, (payload) => events.push({ type, payload })),
  );
});
afterEach(() => {
  unsubscribe.forEach((off) => off());
  vi.restoreAllMocks();
});

const renderView = (props: Partial<Parameters<typeof FlowchartView>[0]> = {}) =>
  render(<FlowchartView graph={iamFlow} claims={iamClaims} {...props} />);

describe('FlowchartView diagram', () => {
  it('renders an SVG with role img and a summary label (F2-R05)', () => {
    renderView();
    const svg = screen.getByRole('img');
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg).toHaveAccessibleName(/How a request is evaluated/);
  });

  it('draws shapes by kind and dashes implied edges (F2-R02, F2-R12)', () => {
    const { container } = renderView();
    expect(container.querySelectorAll('.fc-node--decision polygon.fc-node__shape')).toHaveLength(3);
    expect(container.querySelectorAll('.fc-node--terminal_end rect')).toHaveLength(2);
    expect(container.querySelector('.fc-node--note')).not.toBeNull();
    expect(container.querySelectorAll('path.fc-edge')).toHaveLength(7);
    expect(container.querySelectorAll('path.fc-edge--implied')).toHaveLength(1);
    expect(container.querySelectorAll('marker')).toHaveLength(3);
  });

  it('shows edge labels beside edges (F2-R03)', () => {
    const { container } = renderView();
    const labels = [...container.querySelectorAll('.fc-edge-label text')].map((t) => t.textContent);
    expect(labels.sort()).toEqual(['no', 'no', 'no', 'yes', 'yes', 'yes']);
  });

  it('makes nodes real buttons in topological order (F2-R06)', async () => {
    renderView();
    const nodeButtons = screen.getAllByRole('button').filter((b) => b.classList.contains('fc__hit'));
    expect(nodeButtons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Start: Request arrives',
      'Decision: Explicit deny in any policy?',
      'Decision: Explicit allow in a policy?',
      'Decision: Inside every guardrail that applies?',
      'End: Allowed, positive outcome',
      'End: Denied, negative outcome',
      'Note: Root user: full access by default',
    ]);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Diagram' })); // focus a known control
    await user.tab(); // Text version
    await user.tab(); // Zoom out
    await user.tab(); // Zoom in
    await user.tab(); // Fit (disabled) is skipped, so we land on the scroll region
    await user.tab();
    expect(nodeButtons[0]).toHaveFocus();
    await user.tab();
    expect(nodeButtons[1]).toHaveFocus();
  });

  it('emphasizes highlighted nodes and edges, with more than color (F2-R07)', () => {
    const { container } = renderView({ highlight: { nodeIds: ['N2', 'N6'], edgeIds: ['E2'] } });
    const emphasized = container.querySelectorAll('.fc-node.is-emphasized');
    expect(emphasized).toHaveLength(2);
    expect(emphasized[0].querySelector('.fc-node__ring')).not.toBeNull(); // outline
    expect(container.querySelectorAll('path.fc-edge.is-active')).toHaveLength(1);
    expect(container.querySelectorAll('.fc-node.is-emphasized text')).toHaveLength(2); // bold via CSS class
  });

  it('follows the motion policy (F2-R07)', () => {
    const view = (motion: 'full' | 'reduced' | 'off') => (
      <MotionPolicyProvider userMotionSetting={motion}>
        <FlowchartView graph={iamFlow} claims={iamClaims} />
      </MotionPolicyProvider>
    );
    const { container, rerender } = render(view('full'));
    expect(container.querySelector('.fc')).toHaveAttribute('data-motion', 'full');
    rerender(view('reduced'));
    expect(container.querySelector('.fc')).toHaveAttribute('data-motion', 'reduced');
    rerender(view('off'));
    expect(container.querySelector('.fc')).toHaveAttribute('data-motion', 'off');
  });

  it('renders labels as text, never markup (F2-R10)', () => {
    const g = cloneFlow();
    g.nodes[1].label = '<img src=x onerror=alert(1)> end';
    const { container } = render(<FlowchartView graph={g} claims={iamClaims} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('onerror=alert(1)'); // shown as text (wrapped across tspans)
  });

  it('zooms in and out and can return to fit (F2-R09)', async () => {
    const user = userEvent.setup();
    renderView();
    expect(screen.getByText('100%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('125%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByText('75%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fit to width' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('labels the scroll region (F2-R09)', () => {
    renderView();
    expect(screen.getByRole('region', { name: /scrolls sideways/i })).toBeInTheDocument();
  });
});

describe('node details', () => {
  it('opens a panel on click and emits flow.node.selected', async () => {
    const onNodeSelect = vi.fn();
    const user = userEvent.setup();
    renderView({ onNodeSelect });
    await user.click(screen.getByRole('button', { name: /Decision: Explicit deny/ }));
    const panel = screen.getByRole('region', { name: 'Explicit deny in any policy?' });
    expect(within(panel).getByText(iamClaims.find((c) => c.id === 'C5')!.text)).toBeInTheDocument();
    expect(onNodeSelect).toHaveBeenCalledWith('N2');
    expect(events.some((e) => e.type === 'flow.node.selected' && e.payload.node_id === 'N2')).toBe(true);
  });

  it('opens with Enter and Space (F2-R04)', async () => {
    const user = userEvent.setup();
    renderView();
    const start = screen.getByRole('button', { name: /Start: Request arrives/ });
    start.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('region', { name: 'Request arrives' })).toBeInTheDocument();
    const deny = screen.getByRole('button', { name: /Denied/ });
    deny.focus();
    await user.keyboard(' ');
    expect(screen.getByRole('region', { name: 'Denied' })).toBeInTheDocument();
  });

  it('emits anchor.reveal with the node anchor from "See original text"', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: /Decision: Inside every guardrail/ }));
    await user.click(screen.getByRole('button', { name: 'See original text' }));
    const n4 = iamFlow.nodes.find((n) => n.id === 'N4')!;
    expect(events.find((e) => e.type === 'anchor.reveal')?.payload).toEqual({ anchor: n4.anchor, origin: 'flow_node' });
  });

  it("falls back to the first cited claim's anchor when a node has none", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: /Start: Request arrives/ }));
    await user.click(screen.getByRole('button', { name: 'See original text' }));
    const c1 = iamClaims.find((c) => c.id === 'C1')!;
    expect(events.find((e) => e.type === 'anchor.reveal')?.payload.anchor).toEqual(c1.anchor);
  });

  it('closes and returns focus to the node', async () => {
    const user = userEvent.setup();
    renderView();
    const node = screen.getByRole('button', { name: /Start: Request arrives/ });
    await user.click(node);
    await user.click(screen.getByRole('button', { name: 'Close details' }));
    expect(screen.queryByRole('region', { name: 'Request arrives' })).toBeNull();
    expect(node).toHaveFocus();
  });

  it('fetches cited claims itself when none are passed, and offers retry on failure', async () => {
    const user = userEvent.setup();
    const getClaims = vi
      .spyOn(apiClient, 'getClaims')
      .mockRejectedValueOnce(new Error('server error 500'))
      .mockResolvedValueOnce({ schema_version: '1.0', passage_id: 'iam-01', claims: iamClaims });
    render(<FlowchartView graph={iamFlow} />);
    await user.click(screen.getByRole('button', { name: /Start: Request arrives/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t load/i);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/AWS evaluates the applicable policies/)).toBeInTheDocument();
    expect(getClaims).toHaveBeenCalledWith('iam-01');
  });
});

describe('text version', () => {
  it('is always available and lists 7 items with branches (F2-R05)', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: 'Text version' }));
    const list = screen.getByRole('list', { name: /Text version of the flowchart/ });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(7);
    const n2 = items.find((li) => li.textContent?.startsWith('Decision: Explicit deny in any policy?'))!;
    expect(n2).toHaveTextContent('If yes, go to Denied');
    expect(n2).toHaveTextContent('If no, go to Explicit allow in a policy?');
    expect(list).toHaveTextContent('(implied)');
  });
});

describe('failure handling (F2-R08)', () => {
  it('shows the text version and a message if layout throws, without console errors', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(layoutModule, 'computeLayout').mockImplementation(() => {
      throw new Error('boom');
    });
    renderView();
    expect(screen.getByText(/could not be laid out/i)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /Text version/ })).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('button', { name: 'Diagram' })).toBeDisabled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('shows the text version for an invalid graph', () => {
    const g = cloneFlow();
    g.edges[0].to = 'N99';
    render(<FlowchartView graph={g} claims={iamClaims} />);
    expect(screen.getByText(/does not exist/i)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /Text version/ })).toBeInTheDocument();
  });
});

describe('verification banner', () => {
  it('appears for needs_human, listing the warning', () => {
    renderView();
    const banner = screen.getByRole('note', { name: 'Verification status' });
    expect(banner).toHaveTextContent(/needs a human check/i);
    expect(banner).toHaveTextContent('E4 is implied and needs human review');
  });

  it('is absent when passed and stronger when failed', () => {
    const passed = cloneFlow();
    passed.verification = { status: 'passed', checks: [] };
    const { rerender } = render(<FlowchartView graph={passed} claims={iamClaims} />);
    expect(screen.queryByRole('note', { name: 'Verification status' })).toBeNull();
    const failed = cloneFlow();
    failed.verification = { status: 'failed', checks: [{ name: 'x', layer: 'code', status: 'fail', detail: 'Broken edge' }] };
    rerender(<FlowchartView graph={failed} claims={iamClaims} />);
    expect(screen.getByRole('note', { name: 'Verification status' })).toHaveTextContent(/did not pass/i);
  });
});
