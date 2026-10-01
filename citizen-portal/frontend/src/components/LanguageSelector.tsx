import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { LanguageCode } from '../locales/translations';

export const LanguageSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { language, setLanguage, currentLanguageInfo, supportedLanguages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (code: LanguageCode) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white/90 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors cursor-pointer select-none shadow-2xs"
        aria-label="Select language"
        title="Change Language / भाषा बदलें"
      >
        <Globe size={14} className="text-slate-500 dark:text-slate-400 shrink-0" />
        <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
          {currentLanguageInfo.nativeName}
        </span>
        <ChevronDown
          size={12}
          className={`text-slate-400 dark:text-slate-400 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-60 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3.5 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[10px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
            Select Language • भाषा चुनें
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {supportedLanguages.map((lang) => {
              const isSelected = lang.code === language;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  className={`w-full text-left px-3.5 py-2 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{lang.nativeName}</span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">
                      ({lang.name})
                    </span>
                  </div>
                  {isSelected && (
                    <Check size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
