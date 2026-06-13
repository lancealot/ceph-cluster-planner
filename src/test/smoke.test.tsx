/**
 * UI smoke tests. These mount the full <App /> with its real providers and
 * exercise the cross-cutting behaviors that aren't covered by the calc
 * tests: the shell renders, the stepper captions and rail outputs reflect
 * workspace state, the issues drawer obeys its open/close contracts, the
 * theme toggle drives data-theme, and the tab is mirrored in the URL hash.
 *
 * Each test mounts a fresh tree because setup.ts clears localStorage and the
 * hash between tests, so workspace state and theme don't leak.
 */
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { buildSc846ReferenceScenario } from '../scenarios/sc846-reference';

function seedWorkspace() {
  const scenario = buildSc846ReferenceScenario();
  localStorage.setItem('ccp.v1.workspace', JSON.stringify(scenario.workspace));
}

describe('App shell smoke', () => {
  it('renders the header, stepper, rail, and Components screen on first boot', () => {
    render(<App />);
    expect(screen.getByText('Ceph Cluster Planner')).toBeInTheDocument();
    // All five pipeline numbers visible.
    for (const n of ['01', '02', '03', '04', '05']) {
      expect(screen.getByText(n)).toBeInTheDocument();
    }
    // Rail is mounted with its hero microlabel.
    expect(screen.getByLabelText('Cluster output summary')).toBeInTheDocument();
    expect(screen.getByText('Usable capacity')).toBeInTheDocument();
    // Default landing is 01 Components.
    expect(screen.getByPlaceholderText(/search vendor, model, spec/i)).toBeInTheDocument();
  });

  it('stepper captions and rail outputs reflect a loaded workspace', () => {
    seedWorkspace();
    render(<App />);
    // The SC846 reference workspace has 1 node config, 1 rack config, 1 pool.
    expect(screen.getByText(/1 config$/)).toBeInTheDocument(); // 02 Nodes caption
    expect(screen.getByText(/EC 8\+3/)).toBeInTheDocument();    // 04 Cluster caption
    // Rail hero number should land at 9.33 PB usable for the reference.
    const rail = screen.getByLabelText('Cluster output summary');
    expect(within(rail).getByText('9.33')).toBeInTheDocument();
    expect(within(rail).getByText('PB')).toBeInTheDocument();
  });
});

describe('Pipeline navigation', () => {
  it('clicking a stepper button switches screens and mirrors the tab in the hash', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Click 02 Nodes.
    await user.click(screen.getByText('Nodes'));
    expect(window.location.hash).toBe('#nodes');
    // The Nodes screen empty state should be visible.
    expect(screen.getByText(/no node configs yet/i)).toBeInTheDocument();
    // Click 04 Cluster.
    await user.click(screen.getByText('Cluster'));
    expect(window.location.hash).toBe('#cluster');
    expect(screen.getByText('Capacity cascade — raw to usable')).toBeInTheDocument();
  });
});

describe('Issues drawer', () => {
  it('opens on a severity-chip click and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    // No drawer mounted before the click.
    expect(screen.queryByRole('dialog', { name: /validation issues/i })).not.toBeInTheDocument();
    // Click the rail's "0 errors" chip.
    const rail = screen.getByLabelText('Cluster output summary');
    await user.click(within(rail).getByText(/0 errors/));
    const dialog = await screen.findByRole('dialog', { name: /validation issues/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Escape closes it.
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog', { name: /validation issues/i })).not.toBeInTheDocument();
  });
});

describe('Theme toggle', () => {
  it('clicking Dark sets data-theme="dark"; Light flips it back', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('ccp.v1.theme')).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

describe('Hash routing — initial', () => {
  it('boots into the tab named by the URL hash', () => {
    history.replaceState(null, '', window.location.pathname + window.location.search + '#scenarios');
    render(<App />);
    expect(screen.getByRole('button', { name: /save current as scenario/i })).toBeInTheDocument();
  });
});
