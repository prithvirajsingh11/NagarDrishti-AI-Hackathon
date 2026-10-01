import React, { useEffect } from 'react';
import { Home, Camera, FileText, Map, HelpCircle, Search, Shield } from 'lucide-react';
import { MonumentIcon, IndianFlagRibbon } from './CivicEmblems';
import { useLanguage } from '../context/LanguageContext';

export type NavView = 'home' | 'report' | 'my-reports' | 'map' | 'help' | 'auth' | 'track' | 'authority';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  className?: string;
}

const SHORTCUT_MAP: Record<string, NavView> = {
  '1': 'home',
  '2': 'report',
  '3': 'my-reports',
  '4': 'map',
  '5': 'help',
  'T': 'track',
  'A': 'authority',
};

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, className = '' }) => {
  const { t } = useLanguage();

  const navItems = [
    { id: 'home' as NavView, labelKey: 'nav.home', defaultLabel: 'Home', icon: Home, key: '1' },
    { id: 'report' as NavView, labelKey: 'nav.report_issue', defaultLabel: 'Report Issue', icon: Camera, key: '2' },
    { id: 'my-reports' as NavView, labelKey: 'nav.my_reports', defaultLabel: 'My Reports', icon: FileText, key: '3' },
    { id: 'map' as NavView, labelKey: 'nav.map', defaultLabel: 'Map', icon: Map, key: '4' },
    { id: 'authority' as NavView, labelKey: 'nav.authority', defaultLabel: 'Authority Command', icon: Shield, key: 'A' },
    { id: 'help' as NavView, labelKey: 'nav.help', defaultLabel: 'Help & Support', icon: HelpCircle, key: '5' },
    { id: 'track' as NavView, labelKey: 'home.track_button', defaultLabel: 'Track Status', icon: Search, key: 'T' },
  ];

  // Professional UX: Keyboard shortcut navigation (when not typing in an input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const pressed = e.key.toUpperCase();
      const target = SHORTCUT_MAP[pressed];
      if (target) {
        onNavigate(target);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate]);

  return (
    <aside
      className={`w-60 shrink-0 sticky top-[5.5rem] self-start h-[calc(100vh-7rem)] flex flex-col justify-between py-2 pr-4 pl-3 select-none ${className}`}
    >
      {/* Navigation Items List */}
      <nav className="space-y-1.5 overflow-y-auto min-h-0 pr-1 no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          const label = t(item.labelKey, item.defaultLabel);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`w-full relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer group ${
                isActive
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              {/* Left active vertical accent bar */}
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#0B2545] dark:bg-blue-500 rounded-r-md" />
              )}
              <div className="flex items-center gap-3.5 min-w-0">
                <Icon
                  size={17}
                  className={isActive ? 'text-[#0B2545] dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors'}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span className="tracking-tight truncate">{label}</span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Bottom Clean & Green India Card */}
      <div className="pt-4 shrink-0">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 shadow-2xs text-center flex flex-col items-center overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 mb-2">
            <MonumentIcon className="w-5 h-5 text-slate-800 dark:text-slate-200" />
          </div>
          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-snug tracking-tight mb-2">
            {t('sidebar.together_clean_green', 'Together for a Clean & Green India')}
          </div>
          <IndianFlagRibbon height={12} className="rounded-sm" />
        </div>
      </div>
    </aside>
  );
};
