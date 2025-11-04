import React from 'react';

interface LogoProps {
  size?: number; // height in px
  className?: string;
  variant?: 'login' | 'admin' | 'housekeeping' | 'management' | 'guest';
  src?: string; // optional direct image src
}

const clampSize = (s?: number) => {
  const size = s ?? 64;
  // Allow larger size for login, keep reasonable bounds
  return Math.max(24, Math.min(size, 96));
};

const Logo: React.FC<LogoProps> = ({ size, className = '', variant = 'login', src }) => {
  let providedSrc = src;
  try {
    if (!providedSrc && typeof window !== 'undefined') {
      // For login, prefer login logo; for other panels prefer hotel logo
      const preferLogin = variant === 'login';
      const a = preferLogin ? 'login_logo_url' : 'hotel_logo_url';
      const b = preferLogin ? 'hotel_logo_url' : 'login_logo_url';
      providedSrc = window.localStorage.getItem(a) || window.localStorage.getItem(b) || undefined;
    }
  } catch {
    // ignore localStorage access errors
  }

  const envSrc = process.env.REACT_APP_LOGIN_LOGO_URL as string | undefined;
  const finalSrc = providedSrc || envSrc;

  const heightPx = clampSize(size);

  if (!finalSrc) {
    return null;
  }

  return (
    <img
      src={finalSrc}
      alt="Otel Logosu"
      style={{ height: heightPx, width: 'auto' }}
      className={`object-contain select-none ${className}`}
      draggable={false}
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
};

export default Logo;