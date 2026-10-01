import React from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  Map as MapIcon,
  Flame,
} from 'lucide-react';
import type { AuthorityRoute } from './Sidebar';

interface MobileBottomNavProps {
  currentRoute: AuthorityRoute;
  onRouteChange: (route: AuthorityRoute) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentRoute,
  onRouteChange,
}) => {
  const tabs = [
    { route: '/dashboard' as AuthorityRoute, label: 'Command', icon: LayoutDashboard },
    { route: '/reports' as AuthorityRoute, label: 'Queue', icon: ClipboardList },
    { route: '/map' as AuthorityRoute, label: 'Map', icon: MapIcon },
    { route: '/hotspots' as AuthorityRoute, label: 'Hotspots', icon: Flame },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] px-2 flex items-center justify-around shadow-sm transition-colors select-none"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentRoute === tab.route;
        return (
          <button
            key={tab.route}
            type="button"
            onClick={() => onRouteChange(tab.route)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex-1 min-h-[46px] flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-lg transition-colors touch-manipulation cursor-pointer ${
              isActive
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                  : 'bg-transparent text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[10px] sm:text-[11px] tracking-tight leading-none mt-0.5">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
