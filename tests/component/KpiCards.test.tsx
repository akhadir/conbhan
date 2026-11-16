import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KpiCards } from '../../src/components/analytics/KpiCards';
import { buildGoalStats, computeTotals } from '../../src/lib/analytics';
import { analyticsFixture } from '../fixtures';

const totals = computeTotals(buildGoalStats(analyticsFixture(), '2026-11-16'));

describe('KpiCards', () => {
  it('renders the headline credit and goal KPIs', () => {
    render(<KpiCards totals={totals} />);
    expect(screen.getByText(/total active credits/i)).toBeInTheDocument();
    expect(screen.getByText('827 Credits')).toBeInTheDocument();
    expect(screen.getByText(/total credits of active goals/i)).toBeInTheDocument();
    expect(screen.getByText('790 Credits')).toBeInTheDocument();
    expect(screen.queryByText(/all-time credits earned/i)).not.toBeInTheDocument();
    expect(screen.queryByText('977 Credits')).not.toBeInTheDocument();
    expect(screen.getByText(/^active goals$/i)).toBeInTheDocument();
    expect(screen.getByText(/2 active/)).toBeInTheDocument();
    expect(screen.getByText(/overall completion/i)).toBeInTheDocument();
    expect(screen.getByText('72.12%')).toBeInTheDocument();
  });

  it('flags a filtered view', () => {
    render(<KpiCards totals={totals} filtered />);
    expect(screen.getByText(/filtered/i)).toBeInTheDocument();
  });

  it('renders the combined total of credits held by active goals', () => {
    render(<KpiCards totals={totals} />);
    expect(screen.getByText(/total credits of active goals/i)).toBeInTheDocument();
    expect(screen.getByText('790 Credits')).toBeInTheDocument();
  });
});
