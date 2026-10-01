import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      
      {/* Outer Circle */}
      <circle cx="50" cy="50" r="45" stroke="url(#logoGradient)" strokeWidth="2" opacity="0.2" />
      
      {/* Main Cross */}
      <path 
        d="M50 25V75M25 50H75" 
        stroke="url(#logoGradient)" 
        strokeWidth="12" 
        strokeLinecap="round" 
        filter="url(#glow)"
      />
      
      {/* Search Lens Detail */}
      <circle cx="65" cy="65" r="15" fill="white" stroke="#2563eb" strokeWidth="3" />
      <path d="M75 75L85 85" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
      
      {/* Inner Cross Detail */}
      <path 
        d="M50 35V65M35 50H65" 
        stroke="white" 
        strokeWidth="2" 
        strokeLinecap="round" 
        opacity="0.5"
      />
    </svg>
  );
};
