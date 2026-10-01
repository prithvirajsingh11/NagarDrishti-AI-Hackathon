import React from 'react';
import { LanguageSelector } from './LanguageSelector';
import { useLanguage } from '../context/LanguageContext';

export const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 pt-4 pb-20 lg:pb-4 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 dark:text-slate-400 mt-4 sm:mt-auto select-none transition-colors duration-200">
      <div className="max-w-[1520px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3 font-sans">
        {/* Left Side: Brand and Ministry Info */}
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm tracking-tight font-sans">
            {t('footer.brand')}
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row sm:items-center sm:gap-1.5 leading-tight">
            <span>{t('footer.ministry')}</span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
            <span className="font-medium text-slate-600 dark:text-slate-300">{t('footer.govt')}</span>
          </div>
        </div>

        {/* Right Side: Links & Language Selector */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
          <a
            href="#help"
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Help & Guidelines
          </a>
          <span className="text-slate-200 dark:text-slate-700">|</span>
          <a
            href="#help"
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Helplines & Contact
          </a>
          <span className="text-slate-200 dark:text-slate-700">|</span>
          <div className="inline-flex items-center">
            <LanguageSelector />
          </div>
        </div>
      </div>
    </footer>
  );
};
