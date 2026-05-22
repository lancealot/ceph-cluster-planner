import { describe, expect, it } from 'vitest';
import {
  bytes_to_tb,
  bytes_to_pb,
  format_power,
  format_capacity_tb,
  format_usd,
  format_pct,
} from './units';

describe('format_power boundary at 1000 W', () => {
  it('999 W stays as watts', () => {
    expect(format_power(999)).toBe('999 W');
  });
  it('1000 W displays as kW', () => {
    expect(format_power(1000)).toBe('1.00 kW');
  });
  it('1500 W displays as kW with 2 decimals', () => {
    expect(format_power(1500)).toBe('1.50 kW');
  });
  it('0 W is "0 W"', () => {
    expect(format_power(0)).toBe('0 W');
  });
});

describe('format_capacity_tb boundary at 1000 TB', () => {
  it('999 TB stays as TB', () => {
    expect(format_capacity_tb(999)).toBe('999.00 TB');
  });
  it('1000 TB displays as PB', () => {
    expect(format_capacity_tb(1000)).toBe('1.00 PB');
  });
  it('9300 TB displays as 9.30 PB', () => {
    expect(format_capacity_tb(9300)).toBe('9.30 PB');
  });
  it('sub-TB falls back to GB', () => {
    expect(format_capacity_tb(0.5)).toBe('500.00 GB');
  });
});

describe('byte conversions', () => {
  it('bytes_to_tb is decimal (10^12)', () => {
    expect(bytes_to_tb(1e12)).toBe(1);
    expect(bytes_to_tb(24e12)).toBe(24);
  });
  it('bytes_to_pb is decimal (10^15)', () => {
    expect(bytes_to_pb(1e15)).toBe(1);
  });
});

describe('format_usd thresholds', () => {
  it('< $1k formats as plain dollars', () => {
    expect(format_usd(999)).toBe('$999');
  });
  it('≥ $1k formats with k suffix', () => {
    expect(format_usd(1500)).toBe('$1.5k');
  });
  it('≥ $1M formats with M suffix', () => {
    expect(format_usd(2_500_000)).toBe('$2.50M');
  });
});

describe('format_pct', () => {
  it('formats with default 1 decimal', () => {
    expect(format_pct(0.0123)).toBe('1.2%');
  });
  it('respects digits argument', () => {
    expect(format_pct(0.04, 2)).toBe('4.00%');
  });
});
