import React from 'react';
import { ArrowRight } from 'lucide-react';
import { NagarDrishtiLogo } from '../components/NagarDrishtiLogo';
import type { DashboardStatistics } from '../types/complaint';

interface AuthorityLandingProps {
  onOpenDashboard: () => void;
  stats?: DashboardStatistics | null;
}

export const AuthorityLanding: React.FC<AuthorityLandingProps> = ({
  onOpenDashboard,
  stats,
}) => {
  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 py-12 sm:py-20 text-center max-w-4xl mx-auto transition-colors">
      {/* Icon Badge */}
      <NagarDrishtiLogo size={52} className="mb-5" />

      {/* Main Titles */}
      <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        NagarDrishti AI
      </h1>
      <h2 className="text-lg sm:text-2xl font-semibold text-slate-600 dark:text-slate-400 mt-2">
        Authority Command Portal
      </h2>
      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 tracking-wide uppercase mt-2">
        Municipal Civic Intelligence
      </p>

      {/* Mission statement */}
      <div className="max-w-md text-slate-600 dark:text-slate-400 mt-6 space-y-1.5 text-xs sm:text-sm leading-relaxed">
        <p>Monitor metropolitan infrastructure defects in real time.</p>
        <p>Analyze geographic problem corridors and density hotspots.</p>
        <p>Coordinate departmental dispatch and resolution audit.</p>
      </div>

      {/* Main CTA */}
      <div className="mt-8">
        <button
          onClick={onOpenDashboard}
          className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-950 font-semibold text-xs sm:text-sm rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <span>Open Command Center</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Live System Metrics Quick Snapshot */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-12 w-full text-left">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total City Reports</span>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono tracking-tight">{stats.total_reports}</p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Critical & High</span>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 font-mono tracking-tight">{stats.high_critical}</p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">In Progress</span>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono tracking-tight">{stats.in_progress}</p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Resolved Issues</span>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono tracking-tight">{stats.resolved}</p>
          </div>
        </div>
      )}

      {/* Footer System Architecture Info */}
      <div className="mt-14 pt-6 border-t border-slate-200 dark:border-slate-800/80 text-xs text-slate-400 dark:text-slate-500 flex flex-wrap justify-center gap-4 sm:gap-6">
        <span>Shared FastAPI Backend</span>
        <span>â€¢</span>
        <span>Supabase Spatial PostgreSQL</span>
        <span>â€¢</span>
        <span>Multimodal Gemini Vision</span>
      </div>
    </div>
  );
};
