import type { TrendPoint } from '../../lib/analytics';
import { formatCredits } from '../../lib/credits';
import { formatDate, formatMonth } from '../../lib/dates';

interface TrendChartProps {
  title: string;
  points: TrendPoint[];
  granularity: 'day' | 'month';
}

export function TrendChart({ title, points, granularity }: TrendChartProps) {
  const max = Math.max(1, ...points.map((point) => Math.max(point.earned, Math.abs(point.net))));
  const width = 640;
  const height = 170;
  const padX = 10;
  const padY = 12;
  const innerHeight = height - padY * 2;
  const step = points.length > 0 ? (width - padX * 2) / points.length : 0;
  const barWidth = Math.max(2, step * 0.55);
  const zeroY = padY + innerHeight;

  const netPath = points
    .map((point, index) => {
      const x = padX + step * index + step / 2;
      const y = padY + innerHeight - (Math.max(0, point.net) / max) * innerHeight;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  const totalEarned = points.reduce((sum, point) => sum + point.earned, 0);
  const first = points[0];
  const last = points[points.length - 1];
  const label = (key: string) => (granularity === 'day' ? formatDate(key) : formatMonth(key));

  return (
    <section className="panel chart-panel" aria-label={title}>
      <header className="panel-head">
        <div>
          <h2>{title}</h2>
          <p className="panel-subtitle">
            {formatCredits(totalEarned)} earned in this window
            {first && last ? ` · ${label(first.key)} → ${label(last.key)}` : ''}
          </p>
        </div>
        <div className="chart-legend" aria-hidden="true">
          <span className="legend-item">
            <span className="legend-swatch legend-earned" /> Earned
          </span>
          <span className="legend-item">
            <span className="legend-swatch legend-net" /> Net
          </span>
        </div>
      </header>
      <div className="chart-wrap">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title}: ${formatCredits(totalEarned)} earned`}
          preserveAspectRatio="none"
        >
          <line x1={padX} y1={zeroY} x2={width - padX} y2={zeroY} className="chart-baseline" />
          {points.map((point, index) => {
            const barHeight = (point.earned / max) * innerHeight;
            const x = padX + step * index + (step - barWidth) / 2;
            return (
              <rect
                key={point.key}
                x={x}
                y={zeroY - barHeight}
                width={barWidth}
                height={Math.max(0, barHeight)}
                className="chart-bar"
              >
                <title>
                  {label(point.key)}: {formatCredits(point.earned)} earned
                </title>
              </rect>
            );
          })}
          <path d={netPath} className="chart-net" />
        </svg>
      </div>
    </section>
  );
}
