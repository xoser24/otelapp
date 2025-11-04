import React from 'react';

interface GoldButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'gold' | 'emerald' | 'royal' | 'neutral';
}

const toneMap: Record<NonNullable<GoldButtonProps['tone']>, string> = {
  gold: 'bg-gradient-to-b from-amber-300 to-amber-500 text-black hover:from-amber-200 hover:to-amber-400 focus:ring-amber-400/50',
  emerald: 'bg-gradient-to-b from-emerald-300 to-emerald-500 text-black hover:from-emerald-200 hover:to-emerald-400 focus:ring-emerald-400/50',
  royal: 'bg-gradient-to-b from-blue-300 to-blue-500 text-black hover:from-blue-200 hover:to-blue-400 focus:ring-blue-400/50',
  neutral: 'bg-gradient-to-b from-zinc-200 to-zinc-400 text-black hover:from-zinc-100 hover:to-zinc-300 focus:ring-zinc-400/50',
};

export const GoldButton: React.FC<GoldButtonProps> = ({ tone = 'gold', className = '', children, disabled, ...rest }) => {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-semibold shadow-gold focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-60 disabled:cursor-not-allowed ${toneMap[tone]} ${className}`}
      aria-disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
};

export default GoldButton;