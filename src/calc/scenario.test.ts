import { describe, expect, it } from 'vitest';
import { ScenarioImportError, deserialize, diff, serialize, computeForWorkspace } from './scenario';
import { bundledLibrary } from './test-helpers';
import { buildSc846ReferenceScenario } from '../scenarios/sc846-reference';

const lib = bundledLibrary();

describe('Scenario serialize/deserialize round-trip', () => {
  it('round-trips the SC846 reference workspace', () => {
    const original = buildSc846ReferenceScenario();
    const json = JSON.stringify(original);
    const restored = deserialize(JSON.parse(json));
    expect(restored.workspace).toEqual(original.workspace);
    expect(restored.schema_version).toBe('1');
  });

  it('serialize wraps a workspace with schema_version=1', () => {
    const ref = buildSc846ReferenceScenario();
    const s = serialize(ref.workspace, 'foo');
    expect(s.schema_version).toBe('1');
    expect(s.name).toBe('foo');
    expect(s.workspace).toEqual(ref.workspace);
  });
});

describe('Scenario import validation', () => {
  it('rejects missing schema_version', () => {
    const ref = buildSc846ReferenceScenario();
    const bad = { ...ref };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (bad as any).schema_version;
    expect(() => deserialize(bad)).toThrowError(ScenarioImportError);
  });

  it('rejects mismatched schema_version', () => {
    const bad = { ...buildSc846ReferenceScenario(), schema_version: '2' };
    expect(() => deserialize(bad)).toThrowError(ScenarioImportError);
  });

  it('produces structured issue paths for missing nested fields', () => {
    const bad = {
      schema_version: '1',
      id: 's',
      name: 's',
      created_at: 'now',
      workspace: { nodes: 'not-an-array' },
    };
    try {
      deserialize(bad);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ScenarioImportError);
      const e = err as ScenarioImportError;
      expect(e.issues.some((i) => i.path.startsWith('workspace.'))).toBe(true);
    }
  });
});

describe('SC846 reference scenario matches Phase 3 unit-test math', () => {
  it('computes 9.3 PB usable within 0.5%', () => {
    const ref = buildSc846ReferenceScenario();
    const computed = computeForWorkspace(ref.workspace, lib);
    const usablePb = computed.cluster.total_usable_bytes / 1e15;
    expect(Math.abs(usablePb - 9.3) / 9.3).toBeLessThan(0.005);
    expect(computed.cluster.total_host_count).toBe(30);
    expect(computed.cluster.total_rack_count).toBe(3);
  });
});

describe('Scenario diff: EC 8+3 vs 16+4', () => {
  const base = buildSc846ReferenceScenario();
  const compare = buildSc846ReferenceScenario();
  compare.name = '16+4 variant';
  compare.workspace.cluster.pools[0] = {
    ...compare.workspace.cluster.pools[0],
    k: 16,
    m: 4,
  };

  const result = diff(base, compare, lib);

  it('cost and rack-count unchanged (no hardware diff)', () => {
    expect(result.delta.cost_usd).toBe(0);
    expect(result.delta.rack_count).toBe(0);
    expect(result.delta.node_count).toBe(0);
    expect(result.delta.osd_count).toBe(0);
  });

  it('usable capacity increases (16/20 > 8/11 efficiency)', () => {
    expect(result.delta.usable_capacity_bytes).toBeGreaterThan(0);
  });

  it('raw capacity unchanged', () => {
    expect(result.delta.raw_capacity_bytes).toBe(0);
  });

  it('16+4 needs ≥ 20 hosts; 30 hosts is enough (≥ 2×k+m=40 fails, fires tightness warning)', () => {
    const w = result.warnings_introduced.find((i) => i.code === 'pool.failure_domain_tight');
    expect(w).toBeDefined();
  });
});
