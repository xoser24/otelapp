import React from 'react';
import { AppTheme } from '../theme/AppTheme';

interface GoldGlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: 'gold' | 'emerald' | 'royal' | 'neutral';
  children?: React.ReactNode;
}

const accentMap: Record<NonNullable<GoldGlassCardProps['accent']>, string> = {
  gold: 'bg-gradient-to-b from-amber-300/70 to-amber-500/70',
  emerald: 'bg-gradient-to-b from-emerald-300/70 to-emerald-500/70',
  royal: 'bg-gradient-to-b from-blue-300/70 to-blue-500/70',
  neutral: 'bg-gradient-to-b from-zinc-200/60 to-zinc-400/60',
};

export const GoldGlassCard: React.FC<GoldGlassCardProps> = ({ accent = 'gold', className = '', children, ...rest }) => {
  return (
    <div
      className={`relative rounded-xl p-[1px] gold-border-glow ${className}`}
      style={{ boxShadow: AppTheme.gold.glow }}
    >
      {/* top thin gold line */}
      <div className="absolute inset-x-0 -top-px h-[1px] gold-thin-line" />
      {/* left accent bar */}
      <div className={`absolute left-0 top-0 h-full w-[3px] ${accentMap[accent]} rounded-l-xl`} />

      <div className="gold-glass-surface rounded-xl">
        {children}
      </div>
    </div>
  );
};

export default GoldGlassCard;