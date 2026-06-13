const TB = 1e12;
const TiB = 2 ** 40;
const PB = 1e15;
const PiB = 2 ** 50;

export const bytes_to_tb = (b: number): number => b / TB;
export const bytes_to_tib = (b: number): number => b / TiB;
export const bytes_to_pb = (b: number): number => b / PB;
export const bytes_to_pib = (b: number): number => b / PiB;
export const tb_to_bytes = (tb: number): number => tb * TB;
export const w_to_kw = (w: number): number => w / 1000;

/**
 * Watts when below 1 kW, kW (2 decimals) above. The threshold is the spec's
 * display rule and is pinned by tests in units.test.ts — don't drift.
 */
export const format_power = (watts: number): string => {
  if (watts >= 1000) return `${(watts / 1000).toFixed(2)} kW`;
  return `${Math.round(watts)} W`;
};

/** Always kW (2 decimals). Use for rack-level totals where kW is the natural unit. */
export const format_power_kw = (watts: number): string => `${(watts / 1000).toFixed(2)} kW`;

/**
 * Decimal-prefixed capacity from a TB value. PB ≥ 1000 TB, TB ≥ 1, GB below.
 * Decimals: 2 for PB/TB, 0 for GB — matches the screens.
 */
export const format_capacity_tb = (tb: number): string => {
  if (tb >= 1000) return `${(tb / 1000).toFixed(2)} PB`;
  if (tb >= 1) return `${tb.toFixed(2)} TB`;
  return `${(tb * 1000).toFixed(0)} GB`;
};

export const format_bytes = (bytes: number): string => format_capacity_tb(bytes_to_tb(bytes));

export const format_usd = (n: number): string => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
};

export const format_pct = (ratio: number, digits = 1): string => `${(ratio * 100).toFixed(digits)}%`;
