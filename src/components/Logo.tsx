import React, { useId } from 'react';

interface LogoProps {
  className?: string;
}

// Logo PharmaGuide : bouclier (sécurité) + gélule
export const Logo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="PharmaGuide">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <path d="M50 8 L84 21 V46 C84 69 69 84 50 92 C31 84 16 69 16 46 V21 Z" fill={`url(#${gradientId})`} />
      <g transform="rotate(-40 50 49)">
        <rect x="29" y="40" width="42" height="18" rx="9" fill="#ffffff" />
        <path d="M50 40 H62 A9 9 0 0 1 62 58 H50 Z" fill="#93c5fd" />
      </g>
    </svg>
  );
};
