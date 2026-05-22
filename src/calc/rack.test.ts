import { describe, expect, it } from 'vitest';
import type { RackConfig } from '../types/rack';
import { deriveRack, validateRack } from './rack';
import { defaultClusterDefaults } from '../state/defaults';
import { bundledLibrary } from './test-helpers';
import { SC846_HDD_ONLY } from './fixtures/sc846';

const lib = bundledLibrary();
const defaults = defaultClusterDefaults();
const nodeMap = new Map([[SC846_HDD_ONLY.id, SC846_HDD_ONLY]]);

function rack(count: number, ru: number, powerW: number): RackConfig {
  return {
    id: 'r1',
    name: 'Rack 1',
    ru_capacity: ru,
    power_capacity_w: powerW,
    nodes: [{ node_config_id: SC846_HDD_ONLY.id, count }],
  };
}

describe('Rack of SC846 nodes', () => {
  it('10 nodes fits 42 RU with adequate power', () => {
    const r = rack(10, 42, 12000);
    const d = deriveRack(r, nodeMap, lib, defaults);
    expect(d.ru_used).toBe(40);
    expect(d.node_count).toBe(10);
    expect(d.total_osd_count).toBe(240);
    expect(validateRack(r, d)).toEqual([]);
  });

  it('11 nodes overflows RU (44 > 42)', () => {
    const r = rack(11, 42, 20000);
    const d = deriveRack(r, nodeMap, lib, defaults);
    const issues = validateRack(r, d);
    expect(issues.find((i) => i.code === 'rack.over_ru')).toBeDefined();
  });

  it('binding constraint is "power" when power is tight relative to RU', () => {
    const r = rack(4, 42, 5000);
    const d = deriveRack(r, nodeMap, lib, defaults);
    expect(d.binding_constraint).toBe('power');
  });

  it('binding constraint is "ru" when power is generous', () => {
    const r = rack(9, 42, 50000);
    const d = deriveRack(r, nodeMap, lib, defaults);
    expect(d.binding_constraint).toBe('ru');
  });

  it('raw capacity scales linearly with node count', () => {
    const r = rack(5, 42, 10000);
    const d = deriveRack(r, nodeMap, lib, defaults);
    expect(d.total_raw_bytes / 1e12).toBe(5 * 576);
  });
});
