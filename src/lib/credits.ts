const CREDIT_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** Half-up rounding at 2 decimal places, immune to binary floating point noise. */
export function roundCredits(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Math.sign(value) * Number.EPSILON) * 100) / 100;
}

export function formatAmount(value: number): string {
  return CREDIT_FORMAT.format(roundCredits(value));
}

export function formatCredits(value: number): string {
  return `${formatAmount(value)} ${value === 1 ? 'Credit' : 'Credits'}`;
}

export function formatCompactCredits(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) => String(roundCredits(n));
  if (abs >= 1_000_000_000) return `${trim(value / 1_000_000_000)}B Cr`;
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M Cr`;
  if (abs >= 1_000) return `${trim(value / 1_000)}K Cr`;
  return `${formatAmount(value)} Cr`;
}

export function formatPercent(value: number): string {
  return `${Number(value.toFixed(1))}%`;
}

export function formatSignedCredits(value: number, type: 'credit' | 'debit'): string {
  return `${type === 'debit' ? '−' : '+'}${formatCredits(value)}`;
}

/** Parses a positive credit magnitude; returns null for blank, zero, negative or malformed input. */
export function parseCredits(input: string | number): number | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) return null;
    return roundCredits(input);
  }

  const raw = input.trim();
  const withoutSuffix = raw.replace(/\s*(cr|credits?)$/i, '').trim();
  const plain = /^\d+(\.\d+)?$/.test(withoutSuffix);
  const grouped = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(withoutSuffix);
  if (!plain && !grouped) return null;

  const value = Number(withoutSuffix.replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0) return null;
  return roundCredits(value);
}
