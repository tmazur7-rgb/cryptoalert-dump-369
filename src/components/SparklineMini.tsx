import React from 'react';

interface SparklineMiniProps {
  data?: number[];
  change: number;
  width?: number;
  height?: number;
}

export const SparklineMini: React.FC<SparklineMiniProps> = ({
  data = [],
  change,
  width = 100,
  height = 28,
}) => {
  if (!data || data.length < 2) {
    // Generate a subtle 4-point decline or rise if raw sparkline array is missing
    const isDrop = change < 0;
    return (
      <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
        <path
          d={isDrop ? `M 0 5 Q 50 12, ${width} ${height - 4}` : `M 0 ${height - 4} Q 50 12, ${width} 5`}
          fill="none"
          stroke={isDrop ? '#f43f5e' : '#10b981'}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 3;
  const availableHeight = height - padding * 2;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - padding - ((val - min) / range) * availableHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const isNegative = change < 0;
  const strokeColor = isNegative ? '#f43f5e' : '#10b981';

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0" aria-hidden="true">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};
