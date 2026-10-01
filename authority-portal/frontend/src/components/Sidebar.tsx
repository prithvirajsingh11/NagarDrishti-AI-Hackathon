import React from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  Map as MapIcon,
  Flame,
  Home,
  LogOut,
  ShieldCheck,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NagarDrishtiLogo } from './NagarDrishtiLogo';

export type AuthorityRoute = '/' | '/dashboard' | '/reports' | '/map' | '/hotspots';

interface SidebarProps {
  currentRoute: AuthorityRoute;
  onRouteChange: (route: AuthorityRoute) => void;
  onLogout: () => void;
  onResetDemo?: () => void;
  isResettingDemo?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  onRouteChange,
  onLogout,
  onResetDemo,
  isResettingDemo = false,
  isCollapsed = false,
  onToggleCollapse,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const { user } = useAuth();

  const navItems = [
    { route: '/' as AuthorityRoute, label: 'Portal Home', icon: Home },
    { route: '/dashboard' as AuthorityRoute, label: 'Command Center', icon: LayoutDashboard },
    { route: '/reports' as AuthorityRoute, label: 'Complaint Queue', icon: ClipboardList },
    { route: '/map' as AuthorityRoute, label: 'Map Intelligence', icon: MapIcon },
    { route: '/hotspots' as AuthorityRoute, label: 'Hotspot Intelligence', icon: Flame },
  ];

  const handleNavClick = (route: AuthorityRoute) => {
    onRouteChange(route);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <aside
      className={`bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 h-screen max-h-screen transition-all duration-200 select-none ${
        isCollapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-[70px] min-h-[70px] px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <NagarDrishtiLogo size={32} />
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="font-semibold text-slate-900 dark:text-slate-100 text-xs tracking-tight truncate leading-snug">
                  NagarDrishti AI
                </h1>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                Authority Portal
              </p>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Desktop collapse toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="px-4 pt-3 pb-1">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wider uppercase">
            Municipal Civic Intelligence
          </p>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto min-h-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentRoute === item.route;
          return (
            <button
              key={item.route}
              onClick={() => handleNavClick(item.route)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer group ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-900'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive
                    ? 'text-white dark:text-slate-900'
                    : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                }`}
              />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Authority Profile & System Status */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0 mt-auto bg-white dark:bg-slate-950">
        {!isCollapsed ? (
          <>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 mb-0.5">
                <span className="font-medium">Backend Sync</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Connected
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                FastAPI + Shared Datastore
              </p>
            </div>

            {onResetDemo && (
              <button
                onClick={onResetDemo}
                disabled={isResettingDemo}
                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                title="Resets seeded demo dataset while preserving citizen submissions"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResettingDemo ? 'animate-spin' : ''}`} />
                <span>{isResettingDemo ? 'Resetting...' : 'Reset Demo Data'}</span>
              </button>
            )}

            {user && (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">
                      Authority
                    </span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-300 dark:bg-blue-500/20 rounded font-semibold uppercase">
                    {user.role}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 truncate" title={user.email}>
                  {user.email}
                </p>

                <button
                  onClick={onLogout}
                  className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"
              title="Backend Sync: Connected"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            {user && (
              <button
                onClick={onLogout}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden lg:flex shrink-0 sticky top-0 h-screen z-30">
        {sidebarContent}
      </div>

      {/* Mobile Drawer (Only mounted when opened) */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 transition-opacity animate-in fade-in"
            onClick={onCloseMobile}
          />
          {/* Slide-over Content */}
          <div className="relative z-10 w-72 max-w-[85vw] h-full flex flex-col shadow-xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

