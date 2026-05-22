import { describe, expect, it } from 'vitest';
import { decodeScenarioFromHash, encodeScenarioToHash } from './shareLink';
import { buildSc846ReferenceScenario } from '../scenarios/sc846-reference';

describe('share-link encode / decode round-trip', () => {
  it('round-trips the SC846 reference workspace', () => {
    const ref = buildSc846ReferenceScenario();
    const hash = encodeScenarioToHash(ref.workspace, 'shared');
    expect(hash.startsWith('#s=')).toBe(true);
    const decoded = decodeScenarioFromHash(hash);
    expect(decoded).not.toBeNull();
    expect(decoded?.workspace).toEqual(ref.workspace);
  });

  it('returns null on malformed hash', () => {
    expect(decodeScenarioFromHash('#s=not-base64')).toBeNull();
    expect(decodeScenarioFromHash('#nothing')).toBeNull();
    expect(decodeScenarioFromHash('')).toBeNull();
  });

  it('preserves non-ASCII workspace names (utf-8 safe)', () => {
    const ref = buildSc846ReferenceScenario();
    const ws = { ...ref.workspace, cluster: { ...ref.workspace.cluster, name: 'クラスタ — 30 nodes' } };
    const hash = encodeScenarioToHash(ws, 'shared');
    const decoded = decodeScenarioFromHash(hash);
    expect(decoded?.workspace.cluster.name).toBe('クラスタ — 30 nodes');
  });
});
