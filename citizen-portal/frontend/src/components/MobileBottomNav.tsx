import React, { useEffect, useState } from 'react';
import { Home, Camera, FileText, Map, User, Search, Shield } from 'lucide-react';
import type { NavView } from './Sidebar';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface MobileBottomNavProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  onOpenMenu?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  onOpenMenu,
}) => {
  const { t } = useLanguage();
  const { isLoggedIn, citizen, activeRole, isAuthority } = useAuth();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Android Virtual Keyboard Detection: hide bottom navigation when keyboard is open
  useEffect(() => {
    const handleViewportResize = () => {
      if (window.visualViewport) {
        // When Android soft keyboard appears, viewport height shrinks significantly
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.75;
        setKeyboardVisible(isKeyboard);
      }
    };

    window.visualViewport?.addEventListener('resize', handleViewportResize);
    return () => window.visualViewport?.removeEventListener('resize', handleViewportResize);
  }, []);

  if (keyboardVisible) {
    return null;
  }

  // Authority Navigation Mode
  if (activeRole === 'authority' || isAuthority) {
    return (
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 glass-nav-dock border-t border-slate-200/80 dark:border-slate-800/80 lg:hidden shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_28px_rgba(0,0,0,0.45)] select-none transition-colors"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
        aria-label="Authority Mobile Navigation"
      >
        <div className="grid grid-cols-5 items-center h-16 max-w-md mx-auto px-2">
          {/* 1. Authority Dashboard */}
          <button
            type="button"
            onClick={() => onNavigate('authority')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 cursor-pointer active:scale-90 ${
              currentView === 'authority'
                ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/70 dark:bg-blue-950/40'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Shield size={19} strokeWidth={currentView === 'authority' ? 2.3 : 1.8} className={`transition-transform duration-200 ${currentView === 'authority' ? 'scale-110' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[58px]">
              Dashboard
            </span>
          </button>

          {/* 2. Complaints Queue */}
          <button
            type="button"
            onClick={() => onNavigate('my-reports')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 cursor-pointer active:scale-90 ${
              currentView === 'my-reports'
                ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/70 dark:bg-blue-950/40'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText size={19} strokeWidth={currentView === 'my-reports' ? 2.3 : 1.8} className={`transition-transform duration-200 ${currentView === 'my-reports' ? 'scale-110' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[58px]">
              Queue
            </span>
          </button>

          {/* 3. CENTER PRIMARY: Operational GIS Map */}
          <div className="flex items-center justify-center relative -top-4">
            <button
              type="button"
              onClick={() => onNavigate('map')}
              className={`w-14 h-14 rounded-full flex flex-col items-center justify-center cursor-pointer active:scale-90 transition-all duration-200 shadow-xl ring-4 ring-white dark:ring-[#1a1715] ${
                currentView === 'map'
                  ? 'bg-gradient-to-tr from-blue-700 to-sky-500 text-white shadow-blue-500/40'
                  : 'bg-gradient-to-tr from-[#0B2545] via-[#103a6b] to-blue-600 dark:from-blue-600 dark:to-sky-500 text-white shadow-blue-900/30 dark:shadow-blue-500/30'
              }`}
              aria-label="GIS Map"
              title="Operational Map"
            >
              <Map size={20} strokeWidth={2.2} />
              <span className="text-[9px] font-extrabold tracking-wider uppercase leading-none mt-0.5">
                GIS
              </span>
            </button>
          </div>

          {/* 4. Track Status / Operations */}
          <button
            type="button"
            onClick={() => onNavigate('track')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 cursor-pointer active:scale-90 ${
              currentView === 'track'
                ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/70 dark:bg-blue-950/40'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Search size={19} strokeWidth={currentView === 'track' ? 2.4 : 1.8} className={`transition-transform duration-200 ${currentView === 'track' ? 'scale-110' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[58px]">
              Track
            </span>
          </button>

          {/* 5. Authority Profile */}
          <button
            type="button"
            onClick={() => {
              if (onOpenMenu) onOpenMenu();
              else onNavigate('help');
            }}
            className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 cursor-pointer active:scale-90 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[10px] font-bold">
              {citizen ? citizen.name.slice(0, 1).toUpperCase() : <User size={12} />}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[58px]">
              Profile
            </span>
          </button>
        </div>
      </nav>
    );
  }

  // Citizen Navigation Mode
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 glass-nav-dock border-t border-slate-200/80 dark:border-slate-800/80 lg:hidden shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_28px_rgba(0,0,0,0.45)] select-none transition-colors"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
      aria-label="Mobile Bottom Navigation"
    >
      <div className="grid grid-cols-5 items-center h-16 max-w-md mx-auto px-2">
        {/* 1. Home */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 cursor-pointer active:scale-90 ${
            currentView === 'home'
              ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/70 dark:bg-blue-950/40'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Home size={19} strokeWidth={currentView === 'home' ? 2.3 : 1.8} className={`transition-transform duration-200 ${currentView === 'home' ? 'scale-110' : ''}`} />
          <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[58px]">
            {t('nav.home', 'Home')}
          </span>
        </button>

        {/* 2. Map */}
        <button
          type="button"
          onClick={() => onNavigate('map')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 cursor-pointer active:scale-90 ${
            currentView === 'map'
              ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/70 dark:bg-blue-950/40'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Map size={19} strokeWidth={currentView === 'map' ? 2.3 : 1.8} className={`transition-transform duration-200 ${currentView === 'map' ? 'scale-110' : ''}`} />
          <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[58px]">
            {t('nav.map', 'Map')}
          </span>
        </button>

        {/* 3. CENTER PRIMARY: Report Issue */}
        <div className="flex items-center justify-center relative -top-4">
          <button
            type="button"
            onClick={() => onNavigate('report')}
            className={`w-14 h-14 rounded-full flex flex-col items-center justify-center cursor-pointer active:scale-90 transition-all duration-200 shadow-xl ring-4 ring-white dark:ring-[#1a1715] ${
              currentView === 'report'
                ? 'bg-gradient-to-tr from-blue-700 to-sky-500 text-white shadow-blue-500/40'
                : 'bg-gradient-to-tr from-[#0B2545] via-[#103a6b] to-blue-600 dark:from-blue-600 dark:to-sky-500 text-white shadow-blue-900/30 dark:shadow-blue-500/30'
            }`}
            aria-label="Report Issue"
            title={t('nav.report_issue', 'Report Issue')}
          >
            <Camera size={21} strokeWidth={2.2} className="transition-transform group-hover:scale-110" />
            <span className="text-[9px] font-extrabold tracking-wider uppercase leading-none mt-0.5">
              Report
            </span>
          </button>
        </div>

        {/* 4. My Reports */}
        <button
          type="button"
          onClick={() => onNavigate('my-reports')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 cursor-pointer active:scale-90 ${
            currentView === 'my-reports'
              ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/70 dark:bg-blue-950/40'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText size={19} strokeWidth={currentView === 'my-reports' ? 2.4 : 1.8} className={`transition-transform duration-200 ${currentView === 'my-reports' ? 'scale-110' : ''}`} />
          <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[58px]">
            {t('nav.my_reports', 'Reports')}
          </span>
        </button>

        {/* 5. Track Status or Menu / Profile */}
        {isLoggedIn ? (
          <button
            type="button"
            onClick={() => {
              if (onOpenMenu) onOpenMenu();
              else onNavigate('track');
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 cursor-pointer active:scale-90 ${
              currentView === 'track' || currentView === 'help'
                ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/70 dark:bg-blue-950/40'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[#0B2545] dark:text-blue-400 flex items-center justify-center text-[10px] font-bold">
              {citizen ? citizen.name.slice(0, 1).toUpperCase() : <User size={12} />}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[58px]">
              {citizen?.name.split(' ')[0] || 'Profile'}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('track')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 cursor-pointer active:scale-90 ${
              currentView === 'track'
                ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/70 dark:bg-blue-950/40'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Search size={19} strokeWidth={currentView === 'track' ? 2.4 : 1.8} className={`transition-transform duration-200 ${currentView === 'track' ? 'scale-110' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[58px]">
              Track
            </span>
          </button>
        )}
      </div>
    </nav>
  );
};
