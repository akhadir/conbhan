import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KpiCards } from '../../src/components/analytics/KpiCards';
import { buildGoalStats, computeTotals } from '../../src/lib/analytics';
import { analyticsFixture } from '../fixtures';

const totals = computeTotals(buildGoalStats(analyticsFixture(), '2026-11-16'));

describe('KpiCards', () => {
  it('renders the four headline KPIs', () => {
    render(<KpiCards totals={totals} />);
    expect(screen.getByText(/total active credits/i)).toBeInTheDocument();
    expect(screen.getByText('827 Credits')).toBeInTheDocument();
    expect(screen.getByText(/all-time credits earned/i)).toBeInTheDocument();
    expect(screen.getByText('977 Credits')).toBeInTheDocument();
    expect(screen.getByText(/active goals/i)).toBeInTheDocument();
    expect(screen.getByText(/2 active/)).toBeInTheDocument();
    expect(screen.getByText(/overall completion/i)).toBeInTheDocument();
    expect(screen.getByText('72.12%')).toBeInTheDocument();
  });

  it('mentions cleared credits in the all-time card', () => {
    render(<KpiCards totals={totals} />);
    expect(screen.getByText(/100 Credits cleared/i)).toBeInTheDocument();
  });

  it('flags a filtered view', () => {
    render(<KpiCards totals={totals} filtered />);
    expect(screen.getByText(/filtered/i)).toBeInTheDocument();
  });

  it('renders the combined total of credits held by active goals', () => {
    render(<KpiCards totals={totals} />);
    expect(screen.getByText(/active goal total/i)).toBeInTheDocument();
    expect(screen.getByText('790 Credits')).toBeInTheDocument();
  });
});
