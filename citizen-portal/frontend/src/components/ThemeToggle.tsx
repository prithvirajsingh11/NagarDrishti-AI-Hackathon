import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  const isDark = theme === 'dark';
  const label = isDark
    ? t('nav.theme_light', 'Switch to Light Mode')
    : t('nav.theme_dark', 'Switch to Dark Mode');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer select-none ${className}`}
      title={label}
      aria-label={label}
    >
      <div className="relative w-[18px] h-[18px] flex items-center justify-center">
        {isDark ? (
          <Sun size={18} className="text-amber-400 animate-in spin-in-180 duration-200" />
        ) : (
          <Moon size={18} className="text-slate-600 animate-in spin-in-180 duration-200" />
        )}
      </div>
    </button>
  );
};
