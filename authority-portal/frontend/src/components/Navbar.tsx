import React, { useState, useRef, useEffect } from 'react';
import {
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  LogOut,
  Sun,
  Moon,
  Menu,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { CITIZEN_PORTAL_URL } from '../services/api';
import { NagarDrishtiLogo } from './NagarDrishtiLogo';

interface NavbarProps {
  title: string;
  subtitle?: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
  lastUpdated?: Date;
  onLogout: () => void;
  onOpenMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  subtitle = 'Municipal Civic Intelligence',
  onRefresh,
  isRefreshing = false,
  lastUpdated,
  onLogout,
  onOpenMobileMenu,
}) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'Officer');

  return (
    <header className="h-[70px] min-h-[70px] shrink-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-all duration-200 select-none">
      {/* Left Title & Mobile Menu Trigger */}
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900/80 transition-colors cursor-pointer touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2.5 min-w-0">
          <NagarDrishtiLogo size={32} className="lg:hidden" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                {title}
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[150px] xs:max-w-[220px] sm:max-w-none">
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {lastUpdated && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden xl:inline-block font-mono pr-1">
            Synced {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-850/80 border border-slate-200/60 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer shadow-2xs touch-manipulation"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* Live Refresh Data */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 h-9 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100/90 hover:bg-slate-200/90 dark:bg-slate-900/90 dark:hover:bg-slate-850 border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 rounded-lg transition-all disabled:opacity-50 cursor-pointer shadow-2xs touch-manipulation group"
          title="Refresh live data"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 transition-transform duration-300 ${
              isRefreshing
                ? 'animate-spin text-blue-600 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400 group-hover:rotate-45'
            }`}
          />
          <span className="hidden sm:inline">Sync</span>
        </button>

        {/* Citizen Portal Link (Desktop) */}
        <a
          href={CITIZEN_PORTAL_URL}
          target="_blank"
          rel="noreferrer"
          className="hidden sm:flex items-center gap-1.5 px-3 h-9 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100/60 hover:bg-slate-200/70 dark:bg-slate-900/60 dark:hover:bg-slate-850 border border-slate-200/70 dark:border-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700 rounded-lg transition-all shadow-2xs"
          title="Open Citizen Portal in new tab"
        >
          <span>Citizen Portal</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </a>

        {/* Subtle separator */}
        {user && <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-800/80 mx-0.5" />}

        {/* Authority Account Dropdown Pill */}
        {user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`flex items-center gap-2 px-2.5 sm:px-3 h-9 rounded-lg transition-all cursor-pointer border touch-manipulation ${
                menuOpen
                  ? 'bg-slate-100 dark:bg-slate-850 border-slate-300 dark:border-slate-700 shadow-xs'
                  : 'bg-slate-100/90 hover:bg-slate-200/90 dark:bg-slate-900/90 dark:hover:bg-slate-850 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
              }`}
              title="Authority Account Menu"
              aria-expanded={menuOpen}
            >
              <div className="w-5.5 h-5.5 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-[10px] shadow-xs shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium text-xs text-slate-900 dark:text-slate-100 max-w-[110px] md:max-w-[150px] truncate hidden md:inline-block">
                {displayName}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {user.role}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  menuOpen ? 'rotate-180 text-slate-700 dark:text-slate-200' : ''
                }`}
              />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/80">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {user.fullName || 'Authority Officer'}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5" title={user.email}>
                    {user.email}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400">
                      Verified {user.role}
                    </span>
                  </div>
                </div>

                {/* Mobile Citizen Portal Link inside menu */}
                <div className="sm:hidden border-b border-slate-100 dark:border-slate-800/80 py-1">
                  <a
                    href={CITIZEN_PORTAL_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <span>Citizen Portal</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                </div>

                <div className="pt-1">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50/80 dark:hover:bg-rose-950/30 transition-colors text-left cursor-pointer touch-manipulation"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
