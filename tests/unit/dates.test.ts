import { describe, expect, it } from 'vitest';
import {
  addDaysISO,
  daysBetween,
  formatDate,
  formatMonth,
  isValidISODate,
  lastNDays,
  lastNMonths,
  monthKey,
  parseISODate,
  toISODate,
} from '../../src/lib/dates';

describe('local ISO dates', () => {
  it('formats a local date without UTC shifting', () => {
    expect(toISODate(new Date(2026, 10, 16, 23, 30))).toBe('2026-11-16');
    expect(toISODate(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  });

  it('parses ISO dates at local midnight', () => {
    const d = parseISODate('2026-11-16');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10);
    expect(d.getDate()).toBe(16);
    expect(d.getHours()).toBe(0);
  });

  it('validates ISO date strings strictly', () => {
    expect(isValidISODate('2026-11-16')).toBe(true);
    expect(isValidISODate('2028-02-29')).toBe(true);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('16-11-2026')).toBe(false);
    expect(isValidISODate('2026-1-1')).toBe(false);
    expect(isValidISODate('')).toBe(false);
    expect(isValidISODate(null)).toBe(false);
    expect(isValidISODate(20261116)).toBe(false);
  });

  it('adds days across month and year boundaries using calendar math', () => {
    expect(addDaysISO('2026-11-16', 15)).toBe('2026-12-01');
    expect(addDaysISO('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('counts calendar days between dates', () => {
    expect(daysBetween('2026-11-16', '2026-12-01')).toBe(15);
    expect(daysBetween('2026-12-01', '2026-11-16')).toBe(-15);
    expect(daysBetween('2026-11-16', '2026-11-16')).toBe(0);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('builds month keys and display labels', () => {
    expect(monthKey('2026-11-16')).toBe('2026-11');
    expect(formatMonth('2026-11')).toBe('Nov 2026');
    expect(formatMonth('2025-01')).toBe('Jan 2025');
    expect(formatDate('2026-11-16')).toBe('16 Nov 2026');
  });

  it('lists the last N days and months ending at a date', () => {
    expect(lastNDays('2026-11-16', 3)).toEqual(['2026-11-14', '2026-11-15', '2026-11-16']);
    expect(lastNMonths('2026-11-16', 3)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(lastNMonths('2026-02-10', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(lastNMonths('2026-01-15', 2)).toEqual(['2025-12', '2026-01']);
  });
});
