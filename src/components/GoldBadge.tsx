import React from 'react';

interface GoldBadgeProps {
  variant?: 'empty' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance' | 'payment';
  children?: React.ReactNode;
  className?: string;
}

const badgeStyles: Record<NonNullable<GoldBadgeProps['variant']>, string> = {
  empty: 'bg-amber-50/70 text-amber-800 ring-1 ring-amber-300/60',
  occupied: 'bg-emerald-50/70 text-emerald-800 ring-1 ring-emerald-300/60',
  reserved: 'bg-blue-50/70 text-blue-800 ring-1 ring-blue-300/60',
  cleaning: 'bg-teal-50/70 text-teal-800 ring-1 ring-teal-300/60',
  maintenance: 'bg-rose-50/70 text-rose-800 ring-1 ring-rose-300/60',
  payment: 'bg-fuchsia-50/70 text-fuchsia-800 ring-1 ring-fuchsia-300/60',
};

export const GoldBadge: React.FC<GoldBadgeProps> = ({ variant = 'empty', children, className = '' }) => {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${badgeStyles[variant]} ${className}`}>
      {children}
    </span>
  );
};

export default GoldBadge;