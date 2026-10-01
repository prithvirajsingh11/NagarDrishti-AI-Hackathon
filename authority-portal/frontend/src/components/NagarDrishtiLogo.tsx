import React from 'react';

export const NagarDrishtiLogo: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 36,
}) => (
  <div
    className={`rounded-full bg-[#00875A] flex items-center justify-center text-white shrink-0 shadow-xs ${className}`}
    style={{ width: size, height: size }}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: size * 0.58, height: size * 0.58 }}
    >
      {/* Circular border inner motif */}
      <circle cx="12" cy="12" r="10" strokeWidth="1.5" strokeOpacity="0.4" />
      {/* Sprout stem & leaves */}
      <path d="M12 18V9" />
      <path d="M12 9C12 6.5 14 5 16.5 5C19 5 19 8 16.5 9.5C14.5 10.7 13 11 12 12" />
      <path d="M12 13C10.5 11.5 8 11.5 7 13.5C6 15.5 8 17 10 16C11 15.5 11.8 14.2 12 13" />
    </svg>
  </div>
);
