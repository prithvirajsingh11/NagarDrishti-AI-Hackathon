import React, { useEffect, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  RotateCcw,
  Search,
  ArrowRight,
  X,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import type { CitizenImpactSummary, Complaint } from '../types/complaint';
import { getCitizenImpact, getComplaints, getControlledImageUrl } from '../services/api';
import { getProblemLabel } from '../components/ProblemIcon';
import { StatusBadge } from '../components/StatusBadge';
import { SeverityBadge } from '../components/SeverityBadge';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface CitizenHomeProps {
  onStartReport: () => void;
  onSelectComplaint?: (c: Complaint) => void;
}

export const CitizenHome: React.FC<CitizenHomeProps> = ({ onStartReport, onSelectComplaint }) => {
  const { t } = useLanguage();
  const { citizen, isLoggedIn, token } = useAuth();
  const [recentReports, setRecentReports] = useState<Complaint[]>([]);
  const [impact, setImpact] = useState<CitizenImpactSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackInput, setTrackInput] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_progress' | 'resolved'>('all');
  const [previewComplaint, setPreviewComplaint] = useState<Complaint | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setRecentReports([]);
      setImpact(null);
      setLoading(false);
      return;
    }

    Promise.all([
      getComplaints({ limit: 10 }).catch(() => [] as Complaint[]),
      getCitizenImpact().catch(() => null),
    ])
      .then(([reports, impactData]) => {
        setRecentReports(reports);
        setImpact(impactData);
      })
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  const handleQuickTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = trackInput.trim().toUpperCase();
    if (!id) return;
    window.location.hash = `track?id=${encodeURIComponent(id)}`;
  };

  const filteredReports = recentReports.filter((r) => {
    if (filterStatus === 'in_progress') {
      return r.status === 'IN_PROGRESS' || r.status === 'ASSIGNED' || r.status === 'REPORTED';
    }
    if (filterStatus === 'resolved') {
      return r.status === 'RESOLVED';
    }
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-3 sm:pt-6 pb-2 sm:pb-4 space-y-4 sm:space-y-6 animate-fade-slide-up">
      {/* Hero Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-700 shadow-2xs relative overflow-hidden transition-colors">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{t('home.hero_badge', 'Live Civic Grid Active')}</span>
            </div>

            {isLoggedIn && citizen && (
              <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-3 py-1 rounded-full font-medium flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
                <span>{t('auth.verified_citizen', 'Verified Citizen')}:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{citizen.name}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
              {t('home.hero_title')} <br />
              <span className="text-slate-500 dark:text-slate-400 font-normal">{t('home.hero_subtitle')}</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-normal leading-relaxed max-w-xl">
              {t('home.hero_desc')}
            </p>
          </div>

          {/* Primary Action Button */}
          <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              onClick={onStartReport}
              className="w-full sm:w-auto px-6 py-3 bg-[#0B2545] hover:bg-[#07192f] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all duration-200 inline-flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg active:scale-95 min-h-[44px]"
            >
              <Camera size={16} />
              <span>{t('home.cta_button')}</span>
              <ChevronRight size={15} className="text-slate-300 dark:text-blue-200 ml-0.5" />
            </button>
            {!isLoggedIn && (
              <a
                href="#auth"
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline text-center sm:text-left"
              >
                • {t('auth.signup', 'Sign up')} required to submit
              </a>
            )}
          </div>

          {/* 1-Click Category Launch Bar */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>{t('home.quick_categories', 'Report by Category')}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: 'pothole', labelKey: 'problems.pothole', defaultLabel: 'Pothole', icon: '🕳️' },
                { type: 'garbage', labelKey: 'problems.garbage', defaultLabel: 'Garbage Dump', icon: '🗑️' },
                { type: 'streetlight', labelKey: 'problems.streetlight', defaultLabel: 'Streetlight', icon: '💡' },
                { type: 'drain', labelKey: 'problems.drain', defaultLabel: 'Blocked Drain', icon: '🌊' },
              ].map((cat) => (
                <button
                  key={cat.type}
                  type="button"
                  onClick={onStartReport}
                  className="p-2.5 min-h-[46px] rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs active:scale-95 cursor-pointer flex items-center gap-2 select-none group"
                >
                  <span className="text-base">{cat.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {t(cat.labelKey, cat.defaultLabel)}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">Civic Issue</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Direct Civic Grievance Tracker Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-2xs space-y-3 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Search size={16} />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {t('home.track_widget_title', 'Track Grievance Status')}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('home.track_widget_desc', 'Enter your reference ID to monitor real-time municipal resolution progress.')}
            </p>
          </div>
        </div>

        <form onSubmit={handleQuickTrackSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={trackInput}
            onChange={(e) => setTrackInput(e.target.value)}
            placeholder={t('home.track_input_placeholder', 'Enter Report ID (e.g. ND-2026-4891)...')}
            className="flex-1 px-3.5 py-3 sm:py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-blue-500 font-mono transition-colors min-h-[44px]"
          />
          <button
            type="submit"
            className="px-4 py-3 sm:py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium text-xs rounded-xl transition-all duration-150 shrink-0 cursor-pointer shadow-xs active:scale-95 inline-flex items-center justify-center gap-1.5 min-h-[44px]"
          >
            <span>{t('home.track_button', 'Track Status')}</span>
            <ArrowRight size={13} />
          </button>
        </form>
      </div>

      {/* Your Civic Impact Section */}
      {isLoggedIn && impact && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-2xs space-y-3 font-sans transition-colors">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {t('home.your_civic_impact')}
            </h2>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {t('home.verified_citizen_profile')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-[10.5px] font-medium uppercase tracking-wider">{t('home.submitted')}</span>
                <FileText size={14} className="text-slate-600 dark:text-slate-400" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {impact.total_submitted}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">{t('home.reports_filed')}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
                <span className="text-[10.5px] font-medium uppercase tracking-wider">{t('status.resolved')}</span>
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-xl font-bold text-emerald-900 dark:text-emerald-300 font-mono">
                {impact.resolved_count}
              </div>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400">{t('home.fixed_issues')}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 mb-1">
                <span className="text-[10.5px] font-medium uppercase tracking-wider">{t('status.in_progress')}</span>
                <Clock size={14} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-xl font-bold text-blue-900 dark:text-blue-300 font-mono">
                {impact.in_progress_count}
              </div>
              <span className="text-[10px] text-blue-700 dark:text-blue-400">{t('home.active_municipal_work')}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1">
                <span className="text-[10.5px] font-medium uppercase tracking-wider">{t('myreports.status_reopened')}</span>
                <RotateCcw size={14} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-xl font-bold text-amber-900 dark:text-amber-300 font-mono">
                {impact.reopened_count}
              </div>
              <span className="text-[10px] text-amber-700 dark:text-amber-400">{t('home.under_review')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Reports Section with Interactive Filtering */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('home.recent_reports')}</h2>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full">
              {filteredReports.length} {t('home.live_feed', 'Live Feed')}
            </span>
          </div>

          {/* Interactive Status Filter Tabs */}
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-[11px] ${
                filterStatus === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              {t('home.filter_all', 'All')}
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('in_progress')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-[11px] ${
                filterStatus === 'in_progress'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              {t('home.filter_active', 'Active')}
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('resolved')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-[11px] ${
                filterStatus === 'resolved'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              {t('home.filter_resolved', 'Resolved')}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 text-center text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            {t('home.loading')}
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 text-center text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            {isLoggedIn
              ? t('home.no_reports', 'No reports filed yet. Start by reporting an issue.')
              : 'Sign in to see your recently submitted civic reports.'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredReports.map((c) => {
              const displayImage = getControlledImageUrl(c.image_url, token);

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    if (onSelectComplaint) {
                      onSelectComplaint(c);
                    } else {
                      setPreviewComplaint(c);
                    }
                  }}
                  className="bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-2xs flex items-center gap-3.5 cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0 border border-slate-200 dark:border-slate-600 relative">
                    <img
                      src={displayImage}
                      alt={c.problem_type}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {getProblemLabel(c.problem_type, t)}
                      </span>
                      <SeverityBadge severity={c.severity} size="sm" />
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      <MapPin size={11} className="shrink-0 text-slate-400" />
                      <span className="truncate">{c.location_name}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                      {c.report_id}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <StatusBadge status={c.status} />
                    <ChevronRight size={14} className="text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Preview Modal */}
      {previewComplaint && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-750">
              <div className="space-y-0.5">
                <div className="text-xs font-mono font-semibold text-slate-400">
                  {previewComplaint.report_id}
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {getProblemLabel(previewComplaint.problem_type, t)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewComplaint(null)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-400 hover:text-slate-700 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700">
              <img
                src={getControlledImageUrl(previewComplaint.image_url, token)}
                alt={previewComplaint.problem_type}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/80">
                <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Status</div>
                <StatusBadge status={previewComplaint.status} />
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/80">
                <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Severity</div>
                <SeverityBadge severity={previewComplaint.severity} size="sm" />
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <MapPin size={14} className="text-slate-400 shrink-0" />
              <span className="truncate">{previewComplaint.location_name}</span>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewComplaint(null)}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-750 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer text-center min-h-[40px]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = `track?id=${encodeURIComponent(previewComplaint.report_id)}`;
                  setPreviewComplaint(null);
                }}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-xs min-h-[40px]"
              >
                <span>Full Audit Timeline</span>
                <ExternalLink size={12} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
