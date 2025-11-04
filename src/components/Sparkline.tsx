import React from 'react';

type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  animated?: boolean;
};

const Sparkline: React.FC<SparklineProps> = ({
  values,
  width = 120,
  height = 28,
  color = '#6366f1',
  strokeWidth = 2,
  className = '',
  animated = false,
}) => {
  const len = Math.max(values.length, 2);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (len - 1);

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });

  const path = points.reduce((acc, p, i) => (i === 0 ? `M ${p}` : `${acc} L ${p}`), '');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`${animated ? 'spark-animated' : ''} ${className}`}
      aria-hidden="true"
    >
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" {...(animated ? { pathLength: 100 } : {})} />
    </svg>
  );
};

export default Sparkline;