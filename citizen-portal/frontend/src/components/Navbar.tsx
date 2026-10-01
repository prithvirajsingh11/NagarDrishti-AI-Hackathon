import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronDown,
  LogOut,
  Search,
  CheckCircle2,
  Shield,
  Menu,
  X,
  ArrowRight,
} from 'lucide-react';
import { AshokaEmblem, NagarDrishtiLogo } from './CivicEmblems';
import { LanguageSelector } from './LanguageSelector';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import type { NavView } from './Sidebar';

interface NavbarProps {
  currentView: NavView;
  onNavigate: (view: NavView, authMode?: 'login' | 'signup') => void;
  onSearch?: (query: string) => void;
  mobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
  onCloseMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onSearch,
  mobileMenuOpen: controlledMenuOpen,
  onToggleMobileMenu,
  onCloseMobileMenu,
}) => {
  const { t } = useLanguage();
  const { citizen, isLoggedIn, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);

  const isMenuOpen = controlledMenuOpen !== undefined ? controlledMenuOpen : internalMenuOpen;
  const toggleMenu = onToggleMobileMenu || (() => setInternalMenuOpen(!internalMenuOpen));
  const closeMenu = onCloseMobileMenu || (() => setInternalMenuOpen(false));

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const displayName = citizen?.name || 'Prithviraj';
  const firstName = displayName.split(' ')[0];
  const initials = citizen
    ? citizen.name.slice(0, 2).toUpperCase()
    : 'PR';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery.trim());
      setSearchFocused(false);
      closeMenu();
      onNavigate('my-reports');
    }
  };

  const handleQuickTagClick = (tag: string) => {
    setSearchQuery(tag);
    if (onSearch) {
      onSearch(tag);
    }
    setSearchFocused(false);
    closeMenu();
    onNavigate('my-reports');
  };

  const navLinks = [
    { id: 'home' as NavView, labelKey: 'nav.home', defaultLabel: 'Home' },
    { id: 'report' as NavView, labelKey: 'nav.report_issue', defaultLabel: 'Report Issue' },
    { id: 'my-reports' as NavView, labelKey: 'nav.my_reports', defaultLabel: 'My Reports' },
    { id: 'map' as NavView, labelKey: 'nav.map', defaultLabel: 'Map' },
    { id: 'help' as NavView, labelKey: 'nav.help', defaultLabel: 'Help' },
  ];

  return (
    <header
      className={`sticky top-0 ${isMenuOpen ? 'z-50' : 'z-40'} w-full max-w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-2xs transition-colors safe-top overflow-hidden`}
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}
    >
      <div className="max-w-[1520px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15 sm:h-16 gap-2 sm:gap-4">
          {/* Left: Emblem of India + NagarDrishti AI Brand */}
          <div className="flex items-center gap-1.5 sm:gap-4 shrink min-w-0">
            {/* National Emblem of India */}
            <div
              className="flex items-center cursor-pointer hover:opacity-90 transition-opacity shrink-0"
              onClick={() => onNavigate('home')}
              title={t('footer.govt', 'Government of India')}
            >
              <AshokaEmblem />
            </div>

            {/* Vertical Divider */}
            <div className="h-7 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

            {/* NagarDrishti AI Logo & Tagline */}
            <div
              className="flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none group min-w-0 shrink"
              onClick={() => onNavigate('home')}
            >
              <NagarDrishtiLogo size={28} className="sm:w-[34px] sm:h-[34px] shrink-0" />
              <div className="flex flex-col justify-center leading-none min-w-0 shrink">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="font-bold text-[13px] sm:text-[16px] text-slate-900 dark:text-white tracking-tight font-sans group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                    NagarDrishti AI
                  </span>
                </div>
                <span className="text-[9.5px] sm:text-[10.5px] font-medium text-slate-500 dark:text-slate-400 tracking-tight mt-0.5 font-sans hidden xs:block truncate">
                  {t('nav.brand_subtitle', 'Safer • Cleaner • Greener')}
                </span>
              </div>
            </div>
          </div>

          {/* Center-Left: Desktop Quick Navigation Tabs */}
          <nav className="hidden xl:flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 text-xs font-medium">
            {navLinks.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onNavigate(tab.id)}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  currentView === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t(tab.labelKey, tab.defaultLabel)}
              </button>
            ))}
          </nav>

          {/* Center: Interactive Search reports, locations, or keywords... */}
          <div className="flex-1 max-w-md hidden md:block mx-2 relative" ref={searchContainerRef}>
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('nav.search_placeholder', 'Search reports, locations, or keywords...')}
                className="w-full h-10 pl-10 pr-4 text-xs font-normal text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 bg-[#F1F5F9] dark:bg-slate-800/90 hover:bg-[#EDF2F7] dark:hover:bg-slate-750 focus:bg-white dark:focus:bg-slate-900 rounded-xl border border-transparent focus:border-slate-300 dark:focus:border-slate-700 focus:outline-hidden transition-all shadow-2xs font-sans"
              />
            </form>

            {/* Interactive Search Suggestions Popover */}
            {searchFocused && (
              <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-2.5 text-xs font-sans">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                  <span>Quick Search Tags</span>
                  <span className="text-[9.5px]">Press Enter to search</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Pothole', icon: '🕳️' },
                    { label: 'Garbage', icon: '🗑️' },
                    { label: 'Streetlight', icon: '💡' },
                    { label: 'Blocked Drain', icon: '🌊' },
                    { label: 'MP Nagar', icon: '📍' },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => handleQuickTagClick(chip.label)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 text-xs transition-colors cursor-pointer"
                    >
                      <span>{chip.icon}</span>
                      <span>{chip.label}</span>
                    </button>
                  ))}
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Looking for a report ID?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchFocused(false);
                      window.location.hash = 'track';
                    }}
                    className="text-blue-600 dark:text-blue-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Track ID</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Theme Toggle + Language Selector + Bell + Profile */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Language Selector placed in Navbar */}
            <div className="hidden sm:inline-flex items-center">
              <LanguageSelector />
            </div>

            {/* Light / Dark Mode Toggle */}
            <ThemeToggle />

            {/* Interactive Notification Bell */}
            <div className="relative inline-block" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer select-none"
                title="Notifications"
                aria-label="View notifications"
              >
                <Bell size={18} />
                {hasUnreadNotifications && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                )}
              </button>

              {/* Responsive Notifications Popover */}
              {notificationsOpen && (
                <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 mt-2 sm:w-96 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg p-3 z-50 animate-in fade-in duration-100 text-xs font-sans">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                      <Bell size={14} className="text-amber-500" />
                      <span>{t('nav.notifications', 'Municipal Alerts')}</span>
                    </div>
                    {hasUnreadNotifications && (
                      <button
                        type="button"
                        onClick={() => setHasUnreadNotifications(false)}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        {t('nav.mark_all_read', 'Mark all read')}
                      </button>
                    )}
                  </div>
                  <div className="py-2 space-y-2 max-h-72 overflow-y-auto">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-[11px] flex items-center gap-1">
                          <CheckCircle2 size={12} /> Work Completed
                        </span>
                        <span className="text-[10px] text-slate-400">12m ago</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 text-xs">Pothole repair at MP Nagar Zone-1 verified by municipal engineer.</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1">
                          <Shield size={12} className="text-blue-600 dark:text-blue-400" /> Civic Grid Update
                        </span>
                        <span className="text-[10px] text-slate-400">1h ago</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 text-xs">Streetlight outage auto-clustered in Ward 14. Action dispatched.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Vertical Divider */}
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

            {/* User Profile Pill or Sign In */}
            {isLoggedIn ? (
              <div className="relative inline-block" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-1.5 sm:gap-2 py-1 pl-1 pr-1.5 sm:pr-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer select-none"
                  aria-expanded={profileOpen}
                >
                  {/* Navy Circle Avatar */}
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#0B2545] dark:bg-blue-600 text-white text-xs font-bold flex items-center justify-center tracking-tight shadow-xs font-sans">
                    {initials}
                  </div>
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 hidden sm:inline-block max-w-[110px] truncate font-sans">
                    {firstName}
                  </span>
                  <ChevronDown
                    size={13}
                    className={`text-slate-500 dark:text-slate-400 transition-transform duration-150 ${
                      profileOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Profile Dropdown */}
                {profileOpen && (
                  <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 mt-2 sm:w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-3.5 z-50 text-xs space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                      <div className="w-9 h-9 rounded-full bg-[#0B2545] dark:bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 dark:text-white truncate font-sans">
                          {displayName}
                        </div>
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                          <CheckCircle2 size={11} className="text-emerald-600 dark:text-emerald-400" />
                          <span>{t('auth.verified_citizen', 'Verified Citizen')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="truncate font-sans text-[11px]">
                        <span className="text-slate-400 dark:text-slate-500">Email:</span> {citizen?.email || 'citizen@gov.in'}
                      </div>
                      <div className="text-[10.5px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                        <Shield size={11} className="text-slate-400 dark:text-slate-500" />
                        <span>Aadhaar/OTP Verified</span>
                      </div>
                    </div>

                    <div className="pt-1.5 pb-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          onNavigate('authority');
                        }}
                        className="w-full text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-semibold py-1.5 px-2.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer text-left"
                      >
                        <Shield size={12} />
                        <span>{t('nav.authority', 'Authority Command')}</span>
                      </button>
                    </div>

                    <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          onNavigate('my-reports');
                        }}
                        className="text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium py-1 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        {t('nav.my_reports', 'My Reports')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setProfileOpen(false);
                        }}
                        className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium py-1 px-2.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <LogOut size={12} />
                        <span>{t('auth.logout', 'Sign Out')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('auth', 'login')}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {t('auth.login', 'Sign In')}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('auth', 'signup')}
                  className="px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#0B2545] hover:bg-[#07192f] dark:bg-blue-600 dark:hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-xs"
                >
                  {t('auth.signup', 'Sign Up')}
                </button>
              </div>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={toggleMenu}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer with Backdrop */}
        {isMenuOpen && (
          <div
            className="lg:hidden fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 overflow-y-auto p-4 pb-16 space-y-4 animate-in fade-in duration-150 safe-bottom"
            style={{
              top: 'calc(3.75rem + max(env(safe-area-inset-top, 0px), 0px))',
            }}
          >
            {/* Profile info if logged in */}
            {isLoggedIn && citizen ? (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0B2545] dark:bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
                    {initials}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">{displayName}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{citizen.email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    closeMenu();
                  }}
                  className="px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg flex items-center gap-1"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    onNavigate('auth', 'login');
                  }}
                  className="flex-1 py-2.5 text-center text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-h-[40px]"
                >
                  {t('auth.login', 'Sign In')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    onNavigate('auth', 'signup');
                  }}
                  className="flex-1 py-2.5 text-center text-xs font-semibold bg-[#0B2545] hover:bg-[#07192f] dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-xl transition-colors cursor-pointer shadow-xs min-h-[40px]"
                >
                  {t('auth.signup', 'Sign Up')}
                </button>
              </div>
            )}

            {/* Mobile Search */}
            <div>
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('nav.search_placeholder', 'Search reports, locations...')}
                  className="w-full h-11 pl-10 pr-3 text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl border border-transparent focus:border-slate-300 dark:focus:border-slate-700"
                />
              </form>
            </div>

            {/* Navigation Grid */}
            <div className="grid grid-cols-1 gap-2 font-medium text-xs">
              <button
                onClick={() => {
                  onNavigate('home');
                  closeMenu();
                }}
                className={`p-3 rounded-2xl text-left transition-colors flex items-center justify-between ${
                  currentView === 'home'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>{t('nav.home', 'Home')}</span>
                <span className="text-[11px] text-slate-400">01</span>
              </button>

              <button
                onClick={() => {
                  onNavigate('report');
                  closeMenu();
                }}
                className={`p-3 rounded-2xl text-left transition-colors flex items-center justify-between ${
                  currentView === 'report'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'bg-[#0B2545]/10 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-semibold'
                }`}
              >
                <span>{t('nav.report_issue', 'Report Civic Issue')}</span>
                <span className="text-xs">📸</span>
              </button>

              <button
                onClick={() => {
                  onNavigate('my-reports');
                  closeMenu();
                }}
                className={`p-3 rounded-2xl text-left transition-colors flex items-center justify-between ${
                  currentView === 'my-reports'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>{t('nav.my_reports', 'My Complaints / Reports')}</span>
                <span className="text-[11px] text-slate-400">03</span>
              </button>

              <button
                onClick={() => {
                  onNavigate('map');
                  closeMenu();
                }}
                className={`p-3 rounded-2xl text-left transition-colors flex items-center justify-between ${
                  currentView === 'map'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>{t('nav.map', 'Civic GIS Map')}</span>
                <span className="text-[11px] text-slate-400">04</span>
              </button>

              <button
                onClick={() => {
                  onNavigate('track');
                  closeMenu();
                }}
                className={`p-3 rounded-2xl text-left transition-colors flex items-center justify-between ${
                  currentView === 'track'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>{t('home.track_button', 'Track Grievance Status')}</span>
                <span className="text-[11px] text-slate-400">05</span>
              </button>

              <button
                onClick={() => {
                  onNavigate('help');
                  closeMenu();
                }}
                className={`p-3 rounded-2xl text-left transition-colors flex items-center justify-between ${
                  currentView === 'help'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>{t('nav.help', 'Help & Citizen Support')}</span>
                <span className="text-[11px] text-slate-400">06</span>
              </button>

              <button
                onClick={() => {
                  onNavigate('authority');
                  closeMenu();
                }}
                className={`p-3 rounded-2xl text-left transition-colors flex items-center justify-between border border-blue-200 dark:border-blue-900 ${
                  currentView === 'authority'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Shield size={14} />
                  <span>{t('nav.authority', 'Authority Command')}</span>
                </div>
                <span className="text-[11px]">⚡</span>
              </button>
            </div>

            {/* Mobile Language Selector */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('lang.select_language', 'Language / भाषा')}:
              </span>
              <LanguageSelector />
            </div>

            {/* National Initiative Banner in Drawer */}
            <div className="pt-2 text-center text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                NagarDrishti AI • Civic Intelligence
              </div>
              <div>Government of India • Swachh Bharat • Viksit Bharat</div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

