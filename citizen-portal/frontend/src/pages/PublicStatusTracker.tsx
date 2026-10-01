import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  X
} from 'lucide-react';
import type { ComplaintPublicSummary, ComplaintStatus, ProblemType } from '../types/complaint';
import { getPublicComplaintSummary } from '../services/api';
import { ProblemIcon, getProblemLabel } from '../components/ProblemIcon';
import { StatusBadge } from '../components/StatusBadge';
import { AshokaEmblem } from '../components/CivicEmblems';
import { useLanguage } from '../context/LanguageContext';

interface PublicStatusTrackerProps {
  initialReportId?: string | null;
  onNavigateHome?: () => void;
  onNavigateReport?: () => void;
}

export const PublicStatusTracker: React.FC<PublicStatusTrackerProps> = ({
  initialReportId,
  onNavigateHome,
  onNavigateReport
}) => {
  const { t } = useLanguage();
  const [reportIdInput, setReportIdInput] = useState<string>(initialReportId || '');
  const [summary, setSummary] = useState<ComplaintPublicSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);

  const fetchPublicStatus = async (idToQuery: string) => {
    const cleanId = idToQuery.trim().toUpperCase();
    if (!cleanId) {
      setErrorMessage('Please enter a valid Complaint Reference ID (e.g. NGD-2026-00001).');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await getPublicComplaintSummary(cleanId);
      setSummary(data);
      // Sync URL hash for safe shareable deep-linking
      window.location.hash = `track?id=${encodeURIComponent(cleanId)}`;
    } catch (err: any) {
      setSummary(null);
      setErrorMessage(
        err.message || `No civic record matching "${cleanId}" was found. Please check your tracking number.`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialReportId) {
      setReportIdInput(initialReportId);
      fetchPublicStatus(initialReportId);
    }
  }, [initialReportId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reportIdInput) {
      fetchPublicStatus(reportIdInput);
    }
  };

  const handleShare = async () => {
    if (!summary) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}#track?id=${encodeURIComponent(summary.report_id)}`;
    const shareText = `Civic Complaint Status [${summary.report_id}]: ${summary.status.replace('_', ' ')} (${summary.problem_type}) in ${summary.location_name}. Track online:`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Civic Report ${summary.report_id}`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 3000);
    } catch {
      // fallback
    }
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-4 lg:pb-6 space-y-6 font-sans select-none animate-fade-slide-up">
      {/* Top Government Portal Crest & Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <AshokaEmblem />
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Citizen Services Portal
                </span>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.2 rounded-full font-medium border border-slate-200 dark:border-slate-600">
                  {t('footer.govt')}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {t('track.title')}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 px-2.5 py-1 rounded-full text-[11px] font-semibold text-emerald-800 dark:text-emerald-400">
            <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
            <span>Privacy-Protected Public View</span>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
          {t('track.subtitle')}
        </p>

        {/* Reference Code Lookup Input Form */}
        <form onSubmit={handleSubmit} className="pt-1">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={reportIdInput}
                onChange={(e) => setReportIdInput(e.target.value.toUpperCase())}
                placeholder={t('track.placeholder')}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:border-slate-500 shadow-2xs"
              />
              {reportIdInput && (
                <button
                  type="button"
                  onClick={() => {
                    setReportIdInput('');
                    setSummary(null);
                    setErrorMessage(null);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !reportIdInput.trim()}
              className="px-5 py-2.5 bg-[#0B2545] dark:bg-blue-600 hover:bg-[#07192f] dark:hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>{t('track.btn')}</span>
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error State Banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-2xl text-xs text-rose-900 dark:text-rose-300 flex items-start gap-3 shadow-xs">
          <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">Record Not Found</span>
            <p className="text-[11.5px] leading-relaxed text-rose-800 dark:text-rose-300">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Lookup Result Card */}
      {summary && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs space-y-5">
            {/* Header info bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    {summary.report_id}
                  </span>
                  <StatusBadge status={summary.status as ComplaintStatus} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <ProblemIcon type={(summary.problem_type as ProblemType) || 'other'} size={14} />
                  <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                    {getProblemLabel((summary.problem_type as ProblemType) || 'other', t)}
                  </span>
                  <span>•</span>
                  <span>{summary.department || 'Municipal Department'}</span>
                </div>
              </div>

              {/* Share Status Action */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShare}
                  className="px-3.5 py-1.5 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title="Share public verification link"
                >
                  {copiedShare ? (
                    <>
                      <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{t('myreports.link_copied')}</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={13} />
                      <span>{t('myreports.share_status')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Verification State Callouts */}
            {summary.citizen_resolution_confirmed && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/80 rounded-xl flex items-start gap-2.5 text-xs text-emerald-950 dark:text-emerald-300">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Citizen Verified Resolution</span>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-snug">
                    Resolution confirmed by reporting citizen on {formatDateTime(summary.citizen_resolution_confirmed_at || summary.updated_at)}. Work verified complete on site.
                  </p>
                </div>
              </div>
            )}

            {summary.status === 'RESOLVED' && !summary.citizen_resolution_confirmed && !summary.citizen_reopened && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-950 dark:text-amber-300">
                <Clock size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Resolution Pending Citizen Verification</span>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
                    Field crews marked this incident resolved. Reporting citizen has the authority to verify completion or request reopening if the issue persists.
                  </p>
                </div>
              </div>
            )}

            {(summary.status === 'REOPENED' || summary.citizen_reopened) && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/90 dark:border-rose-800/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-950 dark:text-rose-300">
                <RotateCcw size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Complaint Reopened by Citizen</span>
                  <p className="text-[11px] text-rose-800 dark:text-rose-300 leading-snug">
                    Citizen reported that the issue remains active: <span className="font-semibold italic">"{summary.reopen_reason || 'Problem persists on site.'}"</span>. Re-inspection dispatched.
                  </p>
                </div>
              </div>
            )}

            {summary.pending_status_request && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/80 rounded-xl flex items-center gap-2 text-xs text-blue-900 dark:text-blue-300">
                <Info size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <span>An official citizen follow-up inquiry is currently under active review with {summary.department}.</span>
              </div>
            )}

            {/* Public Fact Sheet Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/70 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block font-semibold">{t('myreports.location')}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block mt-0.5 flex items-center gap-1">
                  <MapPin size={11} className="text-slate-400" />
                  {summary.location_name}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block font-semibold">{t('myreports.submission_date')}</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 block mt-0.5">{formatDateTime(summary.created_at)}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block font-semibold">{t('myreports.last_updated')}</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 block mt-0.5">{formatDateTime(summary.updated_at || summary.created_at)}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block font-semibold">{t('myreports.response_time')}</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 block mt-0.5">
                  {summary.response_time_hours !== null && summary.response_time_hours !== undefined
                    ? `${summary.response_time_hours} hrs from filing`
                    : summary.status === 'RESOLVED'
                    ? 'Resolved'
                    : 'Active'}
                </span>
              </div>
            </div>

            {/* Government Service Lifecycle Timeline */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
                <span>Government Service Lifecycle Stages</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Audit Verified</span>
              </div>

              <div className="space-y-4 pt-1">
                {(summary.timeline_events && summary.timeline_events.length > 0
                  ? summary.timeline_events
                  : [
                      {
                        key: 'REPORTED',
                        title: 'Report Submitted',
                        description: `Report registered with tracking ID ${summary.report_id}.`,
                        timestamp: summary.created_at,
                        state: 'completed' as const,
                      },
                      {
                        key: 'IN_PROGRESS',
                        title: `In Progress (${summary.department})`,
                        description: 'Department routing complete. Field response dispatched.',
                        timestamp: summary.updated_at,
                        state: summary.status === 'REPORTED' ? ('upcoming' as const) : ('completed' as const),
                      },
                      {
                        key: 'RESOLVED',
                        title: 'Resolution by Authority',
                        description: 'Field operations performed on site.',
                        timestamp: summary.resolved_at,
                        state: summary.status === 'RESOLVED' ? ('completed' as const) : ('upcoming' as const),
                      },
                    ]
                ).map((evt, idx, arr) => {
                  const isLast = idx === arr.length - 1;
                  return (
                    <div key={evt.key || idx} className="relative flex items-start gap-3.5">
                      {!isLast && (
                        <div
                          className={`absolute left-2.5 top-6 bottom-0 w-0.5 -ml-[1px] ${
                            evt.state === 'completed' ? 'bg-slate-800 dark:bg-slate-600' : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                        />
                      )}

                      <div className="relative z-10 shrink-0 mt-0.5">
                        {evt.state === 'completed' ? (
                          <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center shadow-xs">
                            <Check size={11} strokeWidth={3} />
                          </div>
                        ) : evt.state === 'current' ? (
                          <div className="w-5 h-5 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-blue-400 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-slate-900 dark:bg-blue-400 animate-pulse" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 flex items-center justify-center" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={`text-xs font-semibold ${
                              evt.state === 'completed'
                                ? 'text-slate-900 dark:text-white'
                                : evt.state === 'current'
                                ? 'text-slate-950 dark:text-slate-100 font-bold'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {evt.title}
                          </span>
                          {evt.state === 'current' && (
                            <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-1.5 py-0.2 rounded uppercase">
                              Current
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-[11px] mt-0.5 leading-snug ${
                            evt.state === 'completed'
                              ? 'text-slate-600 dark:text-slate-400'
                              : evt.state === 'current'
                              ? 'text-slate-700 dark:text-slate-300'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {evt.description}
                        </p>
                        {evt.timestamp && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono block mt-1">
                            {formatDateTime(evt.timestamp)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Contextual Transparency Disclaimers Card */}
          <div className="bg-slate-50/90 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-bold text-[11.5px]">
              <Info size={14} className="text-slate-500 dark:text-slate-400" />
              <span>Governance Transparency &amp; Operating Standards</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              <li>
                <strong className="text-slate-700 dark:text-slate-200">AI-Assisted Estimation:</strong> Severity classifications are preliminary computer-vision evaluations verified by municipal field inspectors.
              </li>
              <li>
                <strong className="text-slate-700 dark:text-slate-200">Citizen Authority:</strong> Final complaint routing and category selection can be reviewed or corrected by the reporting citizen.
              </li>
              <li>
                <strong className="text-slate-700 dark:text-slate-200">Verification Gate:</strong> Resolution is marked complete following authority field execution and may be reopened if the defect persists.
              </li>
              <li>
                <strong className="text-slate-700 dark:text-slate-200">Privacy Safeguard:</strong> Citizen personal identity, telephone records, and private photograph storage paths are strictly excluded from public tracking records.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Initial Empty State Guide */}
      {!summary && !loading && !errorMessage && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto text-slate-500 dark:text-slate-400">
            <Search size={22} />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Check Any Incident in the City
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Every citizen report receives a unique tracking ID formatted as <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">NGD-YYYY-XXXXX</span>. Enter the reference number above to view genuine progress updates.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            {onNavigateHome && (
              <button
                type="button"
                onClick={onNavigateHome}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium text-xs rounded-xl transition-colors cursor-pointer"
              >
                Back to Home
              </button>
            )}
            {onNavigateReport && (
              <button
                type="button"
                onClick={onNavigateReport}
                className="px-3.5 py-1.5 bg-[#0B2545] dark:bg-blue-600 hover:bg-[#07192f] dark:hover:bg-blue-700 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
              >
                File New Report
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
