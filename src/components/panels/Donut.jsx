// ── Donut chart ──────────────────────────────────────────────
// Polished SVG donut with:
//   - Gradient track ring + faint outer halo for depth
//   - Per-segment drop-shadow glow (filter)
//   - Tick marks at 25/50/75 for visual rhythm
//   - Animated arc draw on mount via stroke-dashoffset
//   - Optional onSegmentClick + activeFilter to support filtering UX
//   - Sized via prop; same component is used at 92px in toolbox view
//     and 240px in fullscreen mode.

import React, { useState, useEffect, useId } from "react";

const SEGMENT_COLORS = {
  positive: '#4ade80',
  neutral:  '#fbbf24',
  negative: '#f87171',
};

export function Donut({
  positive = 0,
  neutral  = 0,
  negative = 0,
  size = 96,
  centerColor = 'var(--text-primary)',
  centerLabel = 'last 14d',
  showTicks = true,
  onSegmentClick = null,
  activeFilter = null, // 'positive' | 'neutral' | 'negative' | null
  showHaloPulse = false,
}) {
  const total = positive + neutral + negative;
  const radius = 36;
  const trackRadius = 41;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 11;
  const trackStrokeWidth = 1.5;

  const uid = useId().replace(/:/g, '');

  // Reveal animation — start at 0 and grow.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [positive, neutral, negative]);

  if (total === 0) {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={`empty-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--bg-dark)" />
            <stop offset="100%" stopColor="var(--bg-surface)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={trackRadius} fill="none"
          stroke="var(--border)" strokeWidth={trackStrokeWidth} opacity="0.5" />
        <circle cx="50" cy="50" r={radius} fill="none"
          stroke={`url(#empty-${uid})`} strokeWidth={strokeWidth} opacity="0.4" />
        <text x="50" y="48" textAnchor="middle"
          fontSize="9" fill="var(--text-muted)" fontWeight="600">
          no logs
        </text>
        <text x="50" y="62" textAnchor="middle"
          fontSize="9" fill="var(--text-muted)">
          yet
        </text>
      </svg>
    );
  }

  const posPct = positive / total;
  const neutralPct = neutral / total;
  const negPct = negative / total;

  // Each segment: stroke-dasharray + offset stacked from top (rotate -90).
  const arc = (pctSoFar, pct) => {
    const dash = circumference * pct;
    const gap = circumference - dash;
    const offset = -circumference * pctSoFar;
    return {
      strokeDasharray: `${revealed ? dash : 0} ${revealed ? gap : circumference}`,
      strokeDashoffset: offset,
      transition: 'stroke-dasharray 800ms cubic-bezier(0.16,1,0.3,1)',
    };
  };

  const segActive = (which) => activeFilter === null || activeFilter === which;
  const dimmed = (which) => activeFilter !== null && activeFilter !== which;

  const segmentProps = (color, key) => ({
    cx: 50, cy: 50, r: radius, fill: 'none',
    stroke: color, strokeWidth, strokeLinecap: 'round',
    style: { ...arc(...key.range), filter: `drop-shadow(0 0 4px ${color}aa)`, opacity: dimmed(key.id) ? 0.25 : 1, cursor: onSegmentClick ? 'pointer' : 'default', transition: 'opacity 200ms, stroke-dasharray 800ms cubic-bezier(0.16,1,0.3,1)' },
    onClick: onSegmentClick ? () => onSegmentClick(key.id) : undefined,
  });

  const ranges = {
    positive: { id: 'positive', range: [0, posPct] },
    neutral:  { id: 'neutral',  range: [posPct, neutralPct] },
    negative: { id: 'negative', range: [posPct + neutralPct, negPct] },
  };

  return (
    <svg viewBox="0 0 100 100" width={size} height={size}
      style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`track-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(148,163,184,0.18)" />
          <stop offset="100%" stopColor="rgba(148,163,184,0.04)" />
        </linearGradient>
        <radialGradient id={`halo-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor={`${SEGMENT_COLORS.positive}10`} />
        </radialGradient>
      </defs>

      {/* halo / depth */}
      {showHaloPulse && (
        <circle cx="50" cy="50" r={48} fill={`url(#halo-${uid})`}>
          <animate attributeName="r" values="46;50;46" dur="3.6s" repeatCount="indefinite" />
        </circle>
      )}

      {/* outer track */}
      <circle cx="50" cy="50" r={trackRadius} fill="none"
        stroke="var(--border)" strokeWidth={trackStrokeWidth} opacity="0.5" />

      {/* inner gradient track */}
      <g transform="rotate(-90 50 50)">
        <circle cx="50" cy="50" r={radius} fill="none"
          stroke={`url(#track-${uid})`} strokeWidth={strokeWidth} />

        {posPct > 0 && segActive('positive') !== undefined && (
          <circle {...segmentProps(SEGMENT_COLORS.positive, ranges.positive)} />
        )}
        {neutralPct > 0 && segActive('neutral') !== undefined && (
          <circle {...segmentProps(SEGMENT_COLORS.neutral, ranges.neutral)} />
        )}
        {negPct > 0 && segActive('negative') !== undefined && (
          <circle {...segmentProps(SEGMENT_COLORS.negative, ranges.negative)} />
        )}

        {/* tick marks at 25/50/75 */}
        {showTicks && [0.25, 0.5, 0.75].map(p => {
          const angle = p * 2 * Math.PI;
          const x1 = 50 + (trackRadius + 1) * Math.cos(angle);
          const y1 = 50 + (trackRadius + 1) * Math.sin(angle);
          const x2 = 50 + (trackRadius + 4) * Math.cos(angle);
          const y2 = 50 + (trackRadius + 4) * Math.sin(angle);
          return (
            <line key={p} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="var(--text-muted)" strokeWidth="1" opacity="0.4" />
          );
        })}
      </g>

      {/* center number */}
      <text x="50" y={size > 140 ? 46 : 48} textAnchor="middle"
        fontSize={size > 140 ? "26" : "22"} fontWeight="800" fill={centerColor}
        style={{ letterSpacing: '-0.02em' }}>
        {total}
      </text>
      <text x="50" y={size > 140 ? 64 : 62} textAnchor="middle"
        fontSize={size > 140 ? "10" : "9"} fill="var(--text-muted)" fontWeight="600"
        style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {centerLabel}
      </text>
    </svg>
  );
}

export const DONUT_SEGMENT_COLORS = SEGMENT_COLORS;
