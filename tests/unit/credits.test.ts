import { describe, expect, it } from 'vitest';
import {
  formatCompactCredits,
  formatCredits,
  formatPercent,
  formatSignedCredits,
  parseCredits,
  roundCredits,
} from '../../src/lib/credits';

describe('credit formatting', () => {
  it('formats whole and decimal credits with grouping', () => {
    expect(formatCredits(0)).toBe('0 Credits');
    expect(formatCredits(1)).toBe('1 Credit');
    expect(formatCredits(500)).toBe('500 Credits');
    expect(formatCredits(1250.5)).toBe('1,250.5 Credits');
    expect(formatCredits(1234567.89)).toBe('1,234,567.89 Credits');
  });

  it('never renders currency symbols', () => {
    for (const n of [0, 1, 999.99, 1250000]) {
      expect(formatCredits(n)).not.toMatch(/[$₹€£]/);
      expect(formatCompactCredits(n)).not.toMatch(/[$₹€£]/);
      expect(formatSignedCredits(n, 'credit')).not.toMatch(/[$₹€£]/);
    }
  });

  it('formats compact credits', () => {
    expect(formatCompactCredits(0)).toBe('0 Cr');
    expect(formatCompactCredits(500)).toBe('500 Cr');
    expect(formatCompactCredits(1000)).toBe('1K Cr');
    expect(formatCompactCredits(1200)).toBe('1.2K Cr');
    expect(formatCompactCredits(1250000)).toBe('1.25M Cr');
  });

  it('formats percentages with at most one decimal', () => {
    expect(formatPercent(35)).toBe('35%');
    expect(formatPercent(35.456)).toBe('35.5%');
    expect(formatPercent(100)).toBe('100%');
    expect(formatPercent(0)).toBe('0%');
  });

  it('formats signed ledger amounts', () => {
    expect(formatSignedCredits(500, 'credit')).toBe('+500 Credits');
    expect(formatSignedCredits(250, 'debit')).toBe('−250 Credits');
  });

  // Contract: half-up rounding at 2 decimal places (not banker's rounding).
  it('rounds half-up to two decimals without floating point noise', () => {
    expect(roundCredits(0.1 + 0.2)).toBe(0.3);
    expect(roundCredits(10.005)).toBe(10.01);
    expect(roundCredits(2.4999)).toBe(2.5);
  });
});

describe('credit parsing', () => {
  it('parses plain, grouped and suffixed numbers', () => {
    expect(parseCredits('500')).toBe(500);
    expect(parseCredits('1,250.50')).toBe(1250.5);
    expect(parseCredits(' 500 Cr ')).toBe(500);
    expect(parseCredits('12.345')).toBe(12.35);
    expect(parseCredits(42)).toBe(42);
  });

  it('rejects zero, negative and non-numeric input', () => {
    expect(parseCredits('')).toBeNull();
    expect(parseCredits('   ')).toBeNull();
    expect(parseCredits('abc')).toBeNull();
    expect(parseCredits('0')).toBeNull();
    expect(parseCredits('-5')).toBeNull();
    expect(parseCredits('1.2.3')).toBeNull();
    expect(parseCredits('1,2,3')).toBeNull();
  });
});
