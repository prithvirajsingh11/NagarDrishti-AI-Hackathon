import React from 'react';

// National Emblem of India (Lion Capital of Ashoka) with "भारत सरकार / Government of India"
export const AshokaEmblem: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-2.5 select-none ${className}`}>
    <svg
      viewBox="0 0 100 130"
      className="w-7 h-9 text-slate-800 dark:text-slate-100 shrink-0"
      fill="currentColor"
      aria-label="National Emblem of India"
    >
      {/* Three visible lions of Ashoka Lion Capital */}
      {/* Central Lion Head */}
      <path d="M50 8 C44 8 40 12 40 17 C40 21 43 24 45 25 C43 27 41 31 41 35 C41 41 45 46 50 46 C55 46 59 41 59 35 C59 31 57 27 55 25 C57 24 60 21 60 17 C60 12 56 8 50 8 Z" opacity="0.9" />
      {/* Central Mane & Chest */}
      <path d="M44 32 C38 35 36 42 36 50 C36 57 42 63 50 63 C58 63 64 57 64 50 C64 42 62 35 56 32 C54 36 50 38 46 38 C42 38 44 34 44 32 Z" />
      {/* Central Lion Snout & Whisker details */}
      <circle cx="47" cy="20" r="1.5" fill="#fff" />
      <circle cx="53" cy="20" r="1.5" fill="#fff" />
      <path d="M48 24 L52 24 L50 26 Z" fill="#fff" />
      {/* Left Lion Head & Profile */}
      <path d="M35 15 C30 15 26 19 26 24 C26 28 29 32 32 34 C29 37 27 42 27 48 C27 54 32 59 38 60 C36 54 35 48 36 42 C33 40 31 36 31 32 C31 27 34 22 38 20 C37 17 36 15 35 15 Z" opacity="0.85" />
      <circle cx="31" cy="26" r="1.2" fill="#fff" />
      {/* Right Lion Head & Profile */}
      <path d="M65 15 C70 15 74 19 74 24 C74 28 71 32 68 34 C71 37 73 42 73 48 C73 54 68 59 62 60 C64 54 65 48 64 42 C67 40 69 36 69 32 C69 27 66 22 62 20 C63 17 64 15 65 15 Z" opacity="0.85" />
      <circle cx="69" cy="26" r="1.2" fill="#fff" />
      {/* Front Paws and Pillar Base */}
      <path d="M43 62 L43 78 L47 78 L47 63 Z" />
      <path d="M53 63 L53 78 L57 78 L57 62 Z" />
      <path d="M34 60 L35 76 L39 76 L39 61 Z" opacity="0.8" />
      <path d="M61 61 L61 76 L65 76 L66 60 Z" opacity="0.8" />
      {/* Abacus Platform */}
      <rect x="20" y="78" width="60" height="5" rx="1.5" />
      {/* Ashoka Dharma Chakra (Center of abacus) */}
      <circle cx="50" cy="91" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="50" cy="91" r="2.2" />
      {/* Wheel spokes */}
      <line x1="50" y1="84" x2="50" y2="98" stroke="currentColor" strokeWidth="1" />
      <line x1="43" y1="91" x2="57" y2="91" stroke="currentColor" strokeWidth="1" />
      <line x1="45" y1="86" x2="55" y2="96" stroke="currentColor" strokeWidth="1" />
      <line x1="45" y1="96" x2="55" y2="86" stroke="currentColor" strokeWidth="1" />
      {/* Bull on Right of Chakra */}
      <path d="M64 89 C67 87 70 88 72 90 C74 91 73 95 70 95 C67 95 65 92 64 89 Z" opacity="0.9" />
      {/* Galloping Horse on Left of Chakra */}
      <path d="M36 89 C33 87 30 88 28 90 C26 91 27 95 30 95 C33 95 35 92 36 89 Z" opacity="0.9" />
      {/* Lower Base Platform (Inverted Lotus motif) */}
      <path d="M22 99 C30 96 70 96 78 99 L82 108 C65 111 35 111 18 108 Z" opacity="0.9" />
      <rect x="16" y="108" width="68" height="4" rx="1" />
      {/* Satyameva Jayate Banner base */}
      <path d="M24 114 C35 116 65 116 76 114 L73 120 C60 122 40 122 27 120 Z" opacity="0.75" />
    </svg>
    <div className="hidden sm:flex flex-col justify-center leading-tight">
      <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 tracking-tight">भारत सरकार</span>
      <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 tracking-tight">Government of India</span>
    </div>
  </div>
);

// NagarDrishti AI Sprout Badge Logo (Teal-green circle with white seedling)
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

// India Gate / Monument Line Art Icon for the Left Sidebar bottom card
export const MonumentIcon: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Base step */}
    <rect x="6" y="40" width="36" height="3" rx="0.5" />
    <rect x="8" y="37" width="32" height="3" rx="0.5" />
    {/* Main pillars */}
    <rect x="10" y="16" width="9" height="21" />
    <rect x="29" y="16" width="9" height="21" />
    {/* Central archway */}
    <path d="M19 37V26C19 23.2 21.2 21 24 21C26.8 21 29 23.2 29 26V37" />
    {/* Arch inner detail */}
    <path d="M21 37V27C21 25.3 22.3 24 24 24C25.7 24 27 25.3 27 27V37" strokeWidth="1.2" />
    {/* Cornice & Entablature */}
    <rect x="8" y="13" width="32" height="3" rx="0.5" />
    <rect x="11" y="9" width="26" height="4" rx="0.5" />
    {/* Top Dome / Cupola */}
    <path d="M18 9C18 5.7 20.7 3 24 3C27.3 3 30 5.7 30 9" />
    <line x1="24" y1="1" x2="24" y2="3" />
  </svg>
);

// Indian Tricolor Wavy Ribbon / Banner
export const IndianFlagRibbon: React.FC<{ className?: string; height?: number }> = ({
  className = '',
  height = 14,
}) => (
  <div className={`w-full overflow-hidden ${className}`} style={{ height }}>
    <svg viewBox="0 0 200 24" preserveAspectRatio="none" className="w-full h-full">
      {/* Saffron Wave */}
      <path
        d="M0 0 C50 6 100 -2 150 4 C180 8 190 2 200 4 L200 10 C190 8 180 14 150 10 C100 4 50 12 0 6 Z"
        fill="#FF9933"
      />
      {/* White Wave */}
      <path
        d="M0 6 C50 12 100 4 150 10 C180 14 190 8 200 10 L200 16 C190 14 180 20 150 16 C100 10 50 18 0 12 Z"
        fill="#FFFFFF"
        stroke="#E2E8F0"
        strokeWidth="0.5"
      />
      {/* Ashoka Chakra in White Band */}
      <circle cx="100" cy="11" r="2.2" fill="none" stroke="#000080" strokeWidth="0.6" />
      <circle cx="100" cy="11" r="0.6" fill="#000080" />
      {/* Green Wave */}
      <path
        d="M0 12 C50 18 100 10 150 16 C180 20 190 14 200 16 L200 22 C190 20 180 26 150 22 C100 16 50 24 0 18 Z"
        fill="#138808"
      />
    </svg>
  </div>
);

// Waving Indian Flag Badge (for "Help us build cleaner, safer cities" card)
export const IndianFlagGraphic: React.FC<{ className?: string }> = ({ className = 'w-9 h-6' }) => (
  <svg
    viewBox="0 0 45 30"
    className={`rounded-sm shadow-xs border border-slate-200/60 ${className}`}
  >
    {/* Saffron Band */}
    <rect x="0" y="0" width="45" height="10" fill="#FF9933" />
    {/* White Band */}
    <rect x="0" y="10" width="45" height="10" fill="#FFFFFF" />
    {/* Ashoka Chakra */}
    <circle cx="22.5" cy="15" r="4" fill="none" stroke="#000080" strokeWidth="0.9" />
    <circle cx="22.5" cy="15" r="1" fill="#000080" />
    <path
      d="M22.5 11 L22.5 19 M18.5 15 L26.5 15 M19.7 12.2 L25.3 17.8 M19.7 17.8 L25.3 12.2"
      stroke="#000080"
      strokeWidth="0.5"
    />
    {/* Green Band */}
    <rect x="0" y="20" width="45" height="10" fill="#138808" />
  </svg>
);

// Custom Road Icon (with dashed middle markings for Pothole / Damaged Road)
export const RoadIcon: React.FC<{ className?: string; size?: number; hasCrack?: boolean }> = ({
  className = '',
  size = 16,
  hasCrack = false,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Two road side boundary lines converging slightly */}
    <line x1="4" y1="21" x2="8" y2="3" />
    <line x1="20" y1="21" x2="16" y2="3" />
    {/* Dashed center lane divider */}
    <line x1="12" y1="5" x2="12" y2="8" strokeDasharray="0" />
    <line x1="12" y1="11" x2="12" y2="14" strokeDasharray="0" />
    <line x1="12" y1="17" x2="12" y2="20" strokeDasharray="0" />
    {hasCrack && (
      <path
        d="M9 13 L11 15 L10 17 L12 18"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
    )}
  </svg>
);
