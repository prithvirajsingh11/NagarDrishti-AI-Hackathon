import React from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Zap,
  Download,
  ShieldCheck,
  Info,
  MapPin,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  Complaint,
  DashboardStatistics,
  Department,
  HeatmapPoint,
  HotspotInfo,
  EscalationItem,
  GovernanceOutcomes,
  TimeBasedAnalytics,
} from '../types/complaint';
import {
  getEscalations,
  getGovernanceOutcomes,
  getTimeAnalytics,
  downloadComplaintsCsv,
} from '../services/api';
import { LeafletMap, type MapMode } from '../components/LeafletMap';
import { FilterBar } from '../components/FilterBar';
import { ProblemIcon, getProblemLabel } from '../components/ProblemIcon';
import { StatusBadge } from '../components/StatusBadge';
import { SeverityBadge } from '../components/SeverityBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { RepeatedProblemBanner } from '../components/RepeatedProblemBanner';
import { useTheme } from '../context/ThemeContext';

interface CommandCenterProps {
  stats: DashboardStatistics | null;
  complaints: Complaint[];
  heatmapPoints: HeatmapPoint[];
  departments: Department[];
  loading: boolean;
  onSelectComplaint: (c: Complaint) => void;
  onSelectHotspot: (h: HotspotInfo) => void;
  focusedHotspot: HotspotInfo | null;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  categoryFilter: string;
  onCategoryFilterChange: (val: string) => void;
  severityFilter: string;
  onSeverityFilterChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  departmentFilter: string;
  onDepartmentFilterChange: (val: string) => void;
  resolutionStatusFilter?: string;
  onResolutionStatusFilterChange?: (val: string) => void;
  priorityLevelFilter?: string;
  onPriorityLevelFilterChange?: (val: string) => void;
  dateHorizon: string;
  onDateHorizonChange: (val: string) => void;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  onResetFilters: () => void;
  onNavigateToReports: () => void;
  onNavigateToHotspots: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  stats,
  complaints,
  heatmapPoints,
  departments,
  loading,
  onSelectComplaint,
  onSelectHotspot,
  focusedHotspot,
  mapMode,
  onMapModeChange,
  categoryFilter,
  onCategoryFilterChange,
  severityFilter,
  onSeverityFilterChange,
  statusFilter,
  onStatusFilterChange,
  departmentFilter,
  onDepartmentFilterChange,
  resolutionStatusFilter = '',
  onResolutionStatusFilterChange,
  priorityLevelFilter = '',
  onPriorityLevelFilterChange,
  dateHorizon,
  onDateHorizonChange,
  searchQuery,
  onSearchQueryChange,
  onResetFilters,
  onNavigateToReports,
  onNavigateToHotspots,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Helper to format complaint age
  const formatComplaintAge = (createdAt: string): string => {
    try {
      const diffMs = Date.now() - new Date(createdAt).getTime();
      const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
      if (diffHours < 24) {
        return `${diffHours}h ago`;
      }
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Recent';
    }
  };

  // Phase 6 Priority Actions: Unresolved complaints ranked by deterministic priority score
  const priorityActions = (stats?.priority_actions && stats.priority_actions.length > 0)
    ? stats.priority_actions
    : complaints
        .filter((c) => c.status !== 'RESOLVED')
        .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
        .slice(0, 8);

  // Phase 7 Escalation Center State
  const [escalations, setEscalations] = React.useState<EscalationItem[]>([]);

  React.useEffect(() => {
    let active = true;
    getEscalations()
      .then((data) => {
        if (active && Array.isArray(data)) setEscalations(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [complaints, stats]);

  // Phase 8 Governance Reporting & Outcome Intelligence State
  const [govOutcomes, setGovOutcomes] = React.useState<GovernanceOutcomes | null>(
    stats?.governance_outcomes || null
  );
  const [timeAnalytics, setTimeAnalytics] = React.useState<TimeBasedAnalytics | null>(
    stats?.time_analytics || null
  );
  const [timeMetricView, setTimeMetricView] = React.useState<'received' | 'resolved' | 'reopened'>('received');
  const [isExportingCsv, setIsExportingCsv] = React.useState(false);
  const [exportNotice, setExportNotice] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  React.useEffect(() => {
    if (stats?.governance_outcomes) setGovOutcomes(stats.governance_outcomes);
    if (stats?.time_analytics) setTimeAnalytics(stats.time_analytics);
  }, [stats]);

  React.useEffect(() => {
    let active = true;
    if (!stats?.governance_outcomes) {
      getGovernanceOutcomes()
        .then((data) => {
          if (active && data) setGovOutcomes(data);
        })
        .catch(() => {});
    }
    if (!stats?.time_analytics) {
      getTimeAnalytics()
        .then((data) => {
          if (active && data) setTimeAnalytics(data);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [stats, complaints]);

  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    setExportNotice(null);
    try {
      await downloadComplaintsCsv({
        problem_type: categoryFilter || undefined,
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        department: departmentFilter || undefined,
        resolution_status: resolutionStatusFilter || undefined,
        priority_level: priorityLevelFilter || undefined,
      });
      setExportNotice({ type: 'success', message: 'Complaint records exported successfully.' });
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: any) {
      setExportNotice({
        type: 'error',
        message: err.message || 'Failed to export CSV. Authority privileges required.',
      });
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Derived escalations if API not yet populated or offline
  const displayedEscalations = React.useMemo(() => {
    if (escalations.length > 0) return escalations;
    const items: EscalationItem[] = [];
    const now = Date.now();
    for (const c of complaints) {
      if (c.status === 'RESOLVED' && !c.citizen_reopened) continue;
      const reasons: string[] = [];
      if (c.status === 'REOPENED' || c.citizen_reopened) {
        reasons.push(c.reopen_reason ? `Reopened by citizen: ${c.reopen_reason}` : 'Reopened by citizen');
      }
      const ageDays = (now - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays >= 7 && c.status !== 'RESOLVED') {
        reasons.push(`${Math.floor(ageDays)}+ days unresolved`);
      }
      if (c.status_update_requests?.some((r) => r.state === 'OPEN')) {
        reasons.push('Citizen requested status update');
      }
      if ((c.priority_score ?? 0) >= 50 || c.severity === 'CRITICAL' || c.severity === 'HIGH') {
        reasons.push(`High priority (${c.priority_level || c.severity} urgency)`);
      }
      if (reasons.length > 0) {
        items.push({
          complaint: c,
          reasons,
          primary_reason: reasons[0],
          priority_score: c.priority_score ?? 0,
          priority_level: (c.priority_level as any) || 'MEDIUM',
          days_unresolved: Math.round(ageDays * 10) / 10,
          is_reopened: Boolean(c.status === 'REOPENED' || c.citizen_reopened),
          assigned_to: c.assigned_to,
          department: c.department,
        });
      }
    }
    return items.sort((a, b) => b.priority_score - a.priority_score);
  }, [escalations, complaints]);

  // Phase 6 Aging Analysis Buckets
  const agingData = stats?.aging_analysis;
  const agingBuckets = agingData?.categories && agingData.categories.length > 0
    ? agingData.categories
    : agingData
    ? [
        {
          label: '0–24 hours',
          count: agingData.bucket_0_24h?.count ?? 0,
          percentage: agingData.bucket_0_24h?.percentage ?? 0,
          department_distribution: agingData.bucket_0_24h?.department_breakdown ?? {},
          unresolved_count: agingData.bucket_0_24h?.count ?? 0,
        },
        {
          label: '1–3 days',
          count: agingData.bucket_1_3d?.count ?? 0,
          percentage: agingData.bucket_1_3d?.percentage ?? 0,
          department_distribution: agingData.bucket_1_3d?.department_breakdown ?? {},
          unresolved_count: agingData.bucket_1_3d?.count ?? 0,
        },
        {
          label: '3–7 days',
          count: agingData.bucket_3_7d?.count ?? 0,
          percentage: agingData.bucket_3_7d?.percentage ?? 0,
          department_distribution: agingData.bucket_3_7d?.department_breakdown ?? {},
          unresolved_count: agingData.bucket_3_7d?.count ?? 0,
        },
        {
          label: '7+ days',
          count: agingData.bucket_7d_plus?.count ?? 0,
          percentage: agingData.bucket_7d_plus?.percentage ?? 0,
          department_distribution: agingData.bucket_7d_plus?.department_breakdown ?? {},
          unresolved_count: agingData.bucket_7d_plus?.count ?? 0,
        },
      ]
    : [
        { label: '0–24 hours', count: 0, percentage: 0, department_distribution: {}, unresolved_count: 0 },
        { label: '1–3 days', count: 0, percentage: 0, department_distribution: {}, unresolved_count: 0 },
        { label: '3–7 days', count: 0, percentage: 0, department_distribution: {}, unresolved_count: 0 },
        { label: '7+ days', count: 0, percentage: 0, department_distribution: {}, unresolved_count: 0 },
      ];

  // Phase 6 Department Performance
  const deptPerformance = stats?.department_performance || [];

  // Phase 6 Category Trends
  const catTrends = stats?.category_trends && stats.category_trends.length > 0
    ? stats.category_trends
    : [
        { category: 'pothole', count_7d: 0, count_prior_7d: 0, direction: 'insufficient_data' as const, status_label: 'Insufficient data' },
        { category: 'garbage', count_7d: 0, count_prior_7d: 0, direction: 'insufficient_data' as const, status_label: 'Insufficient data' },
        { category: 'streetlight', count_7d: 0, count_prior_7d: 0, direction: 'insufficient_data' as const, status_label: 'Insufficient data' },
        { category: 'drain', count_7d: 0, count_prior_7d: 0, direction: 'insufficient_data' as const, status_label: 'Insufficient data' },
        { category: 'other', count_7d: 0, count_prior_7d: 0, direction: 'insufficient_data' as const, status_label: 'Insufficient data' },
      ];

  // Category chart data
  const categoryChartData = stats?.by_category
    ? Object.entries(stats.by_category)
        .filter(([, count]) => count > 0)
        .map(([cat, count]) => ({
          name: getProblemLabel(cat),
          count,
          key: cat,
        }))
    : [];

  const categoryColors: Record<string, string> = {
    pothole: isDark ? '#38bdf8' : '#0284c7',
    garbage: isDark ? '#fb923c' : '#d97706',
    streetlight: isDark ? '#818cf8' : '#4f46e5',
    drain: isDark ? '#34d399' : '#059669',
    other: isDark ? '#94a3b8' : '#64748b',
  };

  const trendData = stats?.daily_trends || [];

  const totalReportsCount = stats?.total_reports ?? (loading ? '...' : 0);
  const isZeroData = !loading && (stats?.total_reports ?? 0) === 0 && complaints.length === 0;

  const chartTheme = {
    grid: isDark ? '#1e293b' : '#f1f5f9',
    tick: isDark ? '#94a3b8' : '#64748b',
    tooltipBg: isDark ? '#0f172a' : '#ffffff',
    tooltipBorder: isDark ? '#334155' : '#e2e8f0',
    tooltipColor: isDark ? '#f8fafc' : '#0f172a',
    lineStroke: isDark ? '#60a5fa' : '#2563eb',
  };

  const activeTimePoints = React.useMemo(() => {
    if (!timeAnalytics) return (trendData || []).map((d) => ({ ...d, day_label: d.day_label || (d.date ? d.date.slice(5) : '') }));
    if (timeMetricView === 'resolved') return timeAnalytics.resolved_over_time || [];
    if (timeMetricView === 'reopened') return timeAnalytics.reopened_over_time || [];
    return timeAnalytics.received_over_time || [];
  }, [timeAnalytics, timeMetricView, trendData]);

  const activeCurveColor = timeMetricView === 'resolved'
    ? (isDark ? '#34d399' : '#059669')
    : timeMetricView === 'reopened'
    ? (isDark ? '#f87171' : '#e11d48')
    : (isDark ? '#60a5fa' : '#2563eb');

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-7xl mx-auto transition-colors">
      {/* Export Notification Banner */}
      {exportNotice && (
        <div
          className={`p-3 rounded-xl flex items-center justify-between text-xs font-medium border ${
            exportNotice.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <span>{exportNotice.message}</span>
          <button
            onClick={() => setExportNotice(null)}
            className="text-[10px] font-bold uppercase underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}


      {/* High-Visibility Reopened Alert Indicator */}
      {(stats?.reopened ?? 0) > 0 && (
        <div
          onClick={() => {
            if (onResolutionStatusFilterChange) {
              onResolutionStatusFilterChange('reopened');
            }
            onNavigateToReports();
          }}
          className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-rose-400 dark:hover:border-rose-700 transition-colors shadow-xs group"
          role="alert"
          aria-label="Reopened complaints indicator"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-600 text-white font-bold flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-rose-800 dark:text-rose-200">
                  ⚠ Reopened Complaints
                </h4>
                <span className="px-2 py-0.5 text-xs font-mono font-bold bg-rose-600 text-white rounded-full">
                  {stats?.reopened}
                </span>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                Citizen reported that issue still exists after resolution. Field re-inspection required.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-300 group-hover:translate-x-0.5 transition-transform shrink-0">
            <span>Filter Reopened</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Repeated Problem Intelligence Banner */}
      {stats?.hotspots && stats.hotspots.length > 0 && (
        <RepeatedProblemBanner
          hotspots={stats.hotspots}
          onSelectHotspot={onSelectHotspot}
        />
      )}

      {/* Minimalist KPI Cards including Phase 5 Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 sm:gap-3.5">
        {/* Total Reports */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-[11px] sm:text-xs">Total Reports</span>
            <div className="p-1 sm:p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 mt-1.5 sm:mt-2">
            {totalReportsCount}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate block">All logged incidents</span>
        </div>

        {/* Critical & High */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-xs hover:border-rose-200 dark:hover:border-rose-900/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-rose-700 dark:text-rose-400">
            <span className="font-medium text-[11px] sm:text-xs">Critical & High</span>
            <div className="p-1 sm:p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400 mt-1.5 sm:mt-2">
            {stats?.high_critical ?? (loading ? '...' : 0)}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate block">Requires urgent triage</span>
        </div>

        {/* Pending Triage */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-xs hover:border-amber-200 dark:hover:border-amber-900/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400">
            <span className="font-medium text-[11px] sm:text-xs">Pending Triage</span>
            <div className="p-1 sm:p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400 mt-1.5 sm:mt-2">
            {stats?.pending ?? (loading ? '...' : 0)}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate block">Awaiting department</span>
        </div>

        {/* In Progress */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-xs hover:border-sky-200 dark:hover:border-sky-900/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-sky-700 dark:text-sky-400">
            <span className="font-medium text-[11px] sm:text-xs">In Progress</span>
            <div className="p-1 sm:p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-sky-600 dark:text-sky-400 mt-1.5 sm:mt-2">
            {stats?.in_progress ?? (loading ? '...' : 0)}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate block">Active crew dispatched</span>
        </div>

        {/* Awaiting Verification */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-xs hover:border-indigo-200 dark:hover:border-indigo-900/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-400">
            <span className="font-medium text-[11px] sm:text-xs truncate">Awaiting Verification</span>
            <div className="p-1 sm:p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-indigo-600 dark:text-indigo-400 mt-1.5 sm:mt-2">
            {stats?.awaiting_verification ?? (loading ? '...' : 0)}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate block">Pending citizen sign-off</span>
        </div>

        {/* Resolved */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-xs hover:border-emerald-200 dark:hover:border-emerald-900/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400">
            <span className="font-medium text-[11px] sm:text-xs">Resolved</span>
            <div className="p-1 sm:p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-1.5 sm:mt-2">
            {stats?.resolved ?? (loading ? '...' : 0)}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate block">Completed resolutions</span>
        </div>

        {/* Reopened */}
        <div
          onClick={() => {
            if (onResolutionStatusFilterChange) {
              onResolutionStatusFilterChange('reopened');
            }
            onNavigateToReports();
          }}
          className={`bg-white dark:bg-slate-900 border ${
            (stats?.reopened ?? 0) > 0
              ? 'border-rose-300 dark:border-rose-800 hover:border-rose-400'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
          } rounded-xl p-3 sm:p-4 shadow-xs transition-colors cursor-pointer`}
        >
          <div className="flex items-center justify-between text-xs text-rose-700 dark:text-rose-400">
            <span className="font-medium text-[11px] sm:text-xs">Reopened</span>
            <div className="p-1 sm:p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400 mt-1.5 sm:mt-2">
            {stats?.reopened ?? (loading ? '...' : 0)}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate block">Citizen flagged unresolved</span>
        </div>
      </div>

      {/* Phase 8: Governance Outcome Intelligence */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Governance Outcomes & Performance Intelligence
                </h3>
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                  Evidence-Based
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Municipal service deliverables computed directly from logged civic incidents. Zero speculative data.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={isExportingCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              title="Export complaint dataset respecting current filters"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingCsv ? 'Exporting...' : 'Export Filtered CSV'}</span>
            </button>
          </div>
        </div>

        {/* 9 Outcomes Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Total Complaints */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Complaints</span>
            <p className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {govOutcomes?.total_complaints ?? totalReportsCount}
            </p>
            <span className="text-[10px] text-slate-400 block">Logged authority records</span>
          </div>

          {/* Active Workload */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 tracking-wider">Active Workload</span>
            <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {govOutcomes?.active_complaints ?? ((stats?.pending ?? 0) + (stats?.in_progress ?? 0))}
            </p>
            <span className="text-[10px] text-slate-400 block">Field action underway</span>
          </div>

          {/* Resolved */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">Resolved</span>
            <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {govOutcomes?.resolved_complaints ?? stats?.resolved ?? 0}
            </p>
            <span className="text-[10px] text-slate-400 block">Rectified with evidence</span>
          </div>

          {/* Reopened */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-1">
            <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 tracking-wider">Reopened</span>
            <p className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {govOutcomes?.reopened_complaints ?? stats?.reopened ?? 0}
            </p>
            <span className="text-[10px] text-slate-400 block">Citizen contested resolution</span>
          </div>

          {/* Resolution Rate */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-1">
            <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 tracking-wider">Resolution Rate</span>
            <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {govOutcomes?.resolution_rate_pct != null
                ? `${govOutcomes.resolution_rate_pct}% rate`
                : <span className="text-xs font-normal text-slate-400">Insufficient sample</span>}
            </p>
            <span className="text-[10px] text-slate-400 block">Resolved / Total</span>
          </div>

          {/* Average Response Time */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-1">
            <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400 tracking-wider">Avg Response Time</span>
            <p className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
              {govOutcomes?.avg_response_hours != null
                ? `${govOutcomes.avg_response_hours}h avg`
                : <span className="text-xs font-normal text-slate-400">Insufficient records</span>}
            </p>
            <span className="text-[10px] text-slate-400 block">Intake to initial action</span>
          </div>

          {/* Average Resolution Turnaround */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-1">
            <span className="text-[10px] uppercase font-bold text-teal-700 dark:text-teal-400 tracking-wider">Avg Resolution Time</span>
            <p className="text-2xl font-bold font-mono text-teal-600 dark:text-teal-400">
              {govOutcomes?.avg_resolution_hours != null
                ? `${govOutcomes.avg_resolution_hours}h avg`
                : <span className="text-xs font-normal text-slate-400">No resolved cases</span>}
            </p>
            <span className="text-[10px] text-slate-400 block">Intake to resolution</span>
          </div>

          {/* Pending Citizen Verification */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-1">
            <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-400 tracking-wider">Pending Verification</span>
            <p className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
              {govOutcomes?.pending_citizen_verification ?? stats?.awaiting_verification ?? 0} cases
            </p>
            <span className="text-[10px] text-slate-400 block">Awaiting citizen sign-off</span>
          </div>

          {/* Escalated Cases */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-1 sm:col-span-2 lg:col-span-2">
            <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 tracking-wider">Escalated Cases</span>
            <p className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {govOutcomes?.escalated_cases ?? displayedEscalations.length}
            </p>
            <span className="text-[10px] text-slate-400 block">Priority breaches, repeat flags, or citizen status queries</span>
          </div>
        </div>

        {/* Data Quality & Trust Indicator Footnote */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
          <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span>
            <strong>Data Integrity Standard:</strong> All municipal governance metrics are computed strictly from real timestamped complaints.
            When incident sample sizes are zero in a category or period, "Insufficient data" is explicitly stated rather than artificial numbers.
          </span>
        </div>
      </div>

      {/* Master Filter Bar */}
      <FilterBar
        category={categoryFilter}
        onCategoryChange={onCategoryFilterChange}
        severity={severityFilter}
        onSeverityChange={onSeverityFilterChange}
        status={statusFilter}
        onStatusChange={onStatusFilterChange}
        department={departmentFilter}
        onDepartmentChange={onDepartmentFilterChange}
        resolutionStatus={resolutionStatusFilter}
        onResolutionStatusChange={onResolutionStatusFilterChange}
        priorityLevel={priorityLevelFilter}
        onPriorityLevelChange={onPriorityLevelFilterChange}
        dateHorizon={dateHorizon}
        onDateHorizonChange={onDateHorizonChange}
        search={searchQuery}
        onSearchChange={onSearchQueryChange}
        departments={departments}
        onResetFilters={onResetFilters}
        onExportCsv={handleExportCsv}
        isExporting={isExportingCsv}
      />

      {/* Main Map (Dominant Visual Element) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Metropolitan Geographic Map
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              ({complaints.length} filtered complaints plotted)
            </span>
          </div>
          {focusedHotspot && (
            <span className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2.5 py-0.5 rounded-lg">
              Focus: {focusedHotspot.title}
            </span>
          )}
        </div>

        <LeafletMap
          complaints={complaints}
          heatmapPoints={heatmapPoints}
          mapMode={mapMode}
          onMapModeChange={onMapModeChange}
          onSelectComplaint={onSelectComplaint}
          focusedHotspot={focusedHotspot}
          hotspots={stats?.hotspots || []}
          heightClass="h-[360px] sm:h-[460px]"
        />
      </div>

      {/* Phase 6 Priority Actions: What should we act on first? */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Priority Actions
                </h3>
                <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 px-2 py-0.5 rounded-full font-mono">
                  {priorityActions.length} Urgent Issues
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deterministic municipal priority ranking: What should we act on first?
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (onPriorityLevelFilterChange) onPriorityLevelFilterChange('CRITICAL');
              onNavigateToReports();
            }}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 font-semibold cursor-pointer"
          >
            <span>View Full Priority Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Priority Rows Table (Desktop md+) */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="pb-2.5 font-semibold">Priority</th>
                <th className="pb-2.5 font-semibold">Report ID</th>
                <th className="pb-2.5 font-semibold">Category</th>
                <th className="pb-2.5 font-semibold">Severity</th>
                <th className="pb-2.5 font-semibold">Location</th>
                <th className="pb-2.5 font-semibold">Department</th>
                <th className="pb-2.5 font-semibold">Age</th>
                <th className="pb-2.5 font-semibold">Reopened</th>
                <th className="pb-2.5 font-semibold">Status</th>
                <th className="pb-2.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {priorityActions.length > 0 ? (
                priorityActions.map((c) => {
                  const isReopened = c.status === 'REOPENED' || c.citizen_reopened === true;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => onSelectComplaint(c)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3">
                        <PriorityBadge
                          level={c.priority_level || 'HIGH'}
                          score={c.priority_score}
                          size="sm"
                        />
                      </td>
                      <td className="py-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {c.report_id}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5 capitalize text-slate-700 dark:text-slate-300">
                          <ProblemIcon type={c.problem_type} className="w-3.5 h-3.5 text-slate-500" />
                          <span>{getProblemLabel(c.problem_type)}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <SeverityBadge severity={c.severity} size="sm" />
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-400 max-w-[180px] truncate" title={c.location_name}>
                        {c.location_name}
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-400 max-w-[150px] truncate">
                        {c.department || 'Unassigned'}
                      </td>
                      <td className="py-3 text-slate-500 font-mono text-[11px]">
                        {formatComplaintAge(c.created_at)}
                      </td>
                      <td className="py-3">
                        {isReopened ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            ⚠ Reopened
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={c.status} size="sm" />
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectComplaint(c);
                          }}
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Inspect →
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No active unresolved complaints requiring priority action.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Priority Mobile Cards (< md) */}
        <div className="md:hidden space-y-2.5">
          {priorityActions.length > 0 ? (
            priorityActions.map((c) => {
              const isReopened = c.status === 'REOPENED' || c.citizen_reopened === true;
              return (
                <div
                  key={`mobile-priority-${c.id}`}
                  onClick={() => onSelectComplaint(c)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-xs transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <ProblemIcon type={c.problem_type} className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 capitalize block leading-tight">
                          {getProblemLabel(c.problem_type)}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {c.report_id}
                        </span>
                      </div>
                    </div>
                    <PriorityBadge
                      level={c.priority_level || 'HIGH'}
                      score={c.priority_score}
                      size="xs"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{c.location_name}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <SeverityBadge severity={c.severity} size="sm" />
                      <StatusBadge status={c.status} size="sm" />
                      {isReopened && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                          ⚠ Reopened
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {formatComplaintAge(c.created_at)}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-6 text-center text-xs text-slate-400">
              No active unresolved complaints requiring priority action.
            </div>
          )}
        </div>
      </div>

      {/* Phase 7 Escalation Center: Operational Intervention with Explicit Reasons */}
      <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-100/80 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Escalation Center
                </h3>
                <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 px-2 py-0.5 rounded-full font-mono">
                  {displayedEscalations.length} Active Escalations
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Civic complaints surfaced with transparent, non-generic operational reasons.
              </p>
            </div>
          </div>
        </div>

        {displayedEscalations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayedEscalations.map((esc) => (
              <div
                key={esc.complaint.id}
                onClick={() => onSelectComplaint(esc.complaint)}
                className="p-3.5 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20 hover:border-rose-300 dark:hover:border-rose-800 transition-colors cursor-pointer space-y-2.5 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                      {esc.complaint.report_id}
                    </span>
                    <PriorityBadge
                      level={esc.priority_level as any}
                      score={esc.priority_score}
                      size="sm"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <ProblemIcon type={esc.complaint.problem_type} className="w-3.5 h-3.5 text-slate-500" />
                    <span className="capitalize">{getProblemLabel(esc.complaint.problem_type)}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500 dark:text-slate-400 truncate text-[11px] font-normal">
                      {esc.complaint.location_name || 'City Coordinates'}
                    </span>
                  </div>

                  {/* Explicit Reasons */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider">
                      Escalation Triggers:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {esc.reasons.map((r, rIdx) => (
                        <span
                          key={rIdx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-rose-100/80 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                    {esc.department || 'Unassigned Dept'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectComplaint(esc.complaint);
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Triage</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-4 italic">
            No operational escalations flagged. All complaints proceeding within standard tolerances.
          </p>
        )}
      </div>

      {/* Phase 6 Complaint Aging Intelligence */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xs font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Complaint Aging
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Unresolved Turnaround Profile ({agingData?.total_unresolved ?? 0} active)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {agingBuckets.map((bucket, idx) => {
            const isCriticalAge = bucket.label === '7+ days' && bucket.count > 0;
            const isHighAge = bucket.label === '3–7 days' && bucket.count > 0;
            return (
              <div
                key={idx}
                className={`p-3.5 rounded-lg border ${
                  isCriticalAge
                    ? 'border-rose-300 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20'
                    : isHighAge
                    ? 'border-amber-300 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40'
                } space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    {bucket.label}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                    {bucket.percentage}%
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold font-mono ${
                    isCriticalAge ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
                  }`}>
                    {bucket.count}
                  </span>
                  <span className="text-[11px] text-slate-500">unresolved</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      bucket.label === '7+ days'
                        ? 'bg-rose-600'
                        : bucket.label === '3–7 days'
                        ? 'bg-amber-500'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, bucket.percentage))}%` }}
                  />
                </div>
                {/* Department distribution */}
                <div className="pt-1.5 text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
                  {Object.entries(bucket.department_distribution || {}).slice(0, 2).map(([dept, cCnt], dIdx) => (
                    <div key={dIdx} className="flex justify-between truncate">
                      <span className="truncate max-w-[130px]">{dept}:</span>
                      <span className="font-mono font-semibold">{String(cCnt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase 6 Department Performance & Workload */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-xs font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Department Performance
            </h3>
            <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">• Workload & Operational Capacity</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">
            Operational Visibility • Click to Filter
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="pb-2.5 font-semibold">Department</th>
                <th className="pb-2.5 font-semibold text-center">Total</th>
                <th className="pb-2.5 font-semibold text-center">Assigned</th>
                <th className="pb-2.5 font-semibold text-center">Active Workload</th>
                <th className="pb-2.5 font-semibold text-center">Pending</th>
                <th className="pb-2.5 font-semibold text-center">Resolved</th>
                <th className="pb-2.5 font-semibold text-center">Reopened</th>
                <th className="pb-2.5 font-semibold">Avg Turnaround</th>
                <th className="pb-2.5 font-semibold">Resolution Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {deptPerformance.length > 0 ? (
                deptPerformance.map((dp, idx) => (
                  <tr
                    key={idx}
                    onClick={() => {
                      onDepartmentFilterChange(dp.department);
                      onNavigateToReports();
                    }}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <span>{dp.department}</span>
                    </td>
                    <td className="py-2.5 font-mono text-center font-semibold">{dp.total}</td>
                    <td className="py-2.5 font-mono text-center text-blue-600 font-semibold">
                      {dp.assigned ?? (dp.pending + dp.in_progress)}
                    </td>
                    <td className="py-2.5 font-mono text-center text-amber-600 font-semibold">
                      {dp.active_workload ?? (dp.pending + dp.in_progress + dp.reopened)}
                    </td>
                    <td className="py-2.5 font-mono text-center text-slate-600 dark:text-slate-400">{dp.pending}</td>
                    <td className="py-2.5 font-mono text-center text-emerald-600 font-semibold">{dp.resolved}</td>
                    <td className="py-2.5 font-mono text-center text-rose-600 font-semibold">{dp.reopened}</td>
                    <td className="py-2.5 font-mono text-slate-600 dark:text-slate-400">
                      {dp.avg_resolution_hours !== null && dp.avg_resolution_hours !== undefined ? (
                        `${dp.avg_resolution_hours}h`
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Unavailable (no resolved cases)</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.max(0, dp.resolution_rate))}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 w-10 text-right">
                          {dp.resolution_rate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">
                    No department data logged.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phase 6 Category Trend Intelligence */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-xs font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Category Trend Intelligence
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
            7-Day & 30-Day Velocity Analysis
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {catTrends.map((tr, idx) => {
            const isInsufficient = tr.direction === 'insufficient_data';
            const isInc = tr.direction === 'increasing';
            const isDec = tr.direction === 'decreasing';
            return (
              <div
                key={idx}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold capitalize text-slate-800 dark:text-slate-200">
                    {tr.category}
                  </span>
                  <ProblemIcon type={tr.category} className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                    {tr.count_7d}
                  </span>
                  <span className="text-[10px] text-slate-500">past 7d</span>
                </div>
                <div>
                  {isInsufficient ? (
                    <span className="text-[10px] font-medium text-slate-400 bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      Insufficient data
                    </span>
                  ) : (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isInc
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : isDec
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {tr.status_label || (tr.velocity_change_pct !== null && tr.velocity_change_pct !== undefined ? `${tr.velocity_change_pct > 0 ? '+' : ''}${Math.round(tr.velocity_change_pct)}%` : tr.direction)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Split Section: Top Hotspots vs Recent Complaints */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Hotspots */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <h3 className="text-xs font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Top Geographic Hotspots
              </h3>
            </div>
            <button
              onClick={onNavigateToHotspots}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 font-medium cursor-pointer transition-colors"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800 flex-1">
            {stats?.hotspots && stats.hotspots.length > 0 ? (
              stats.hotspots.slice(0, 4).map((h, i) => (
                <div
                  key={i}
                  onClick={() => onSelectHotspot(h)}
                  className="py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[11px] font-semibold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-medium text-slate-900 dark:text-slate-200">{h.title}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                        Dominant: {h.dominant_issue} • {h.total_reports} incidents ({h.unresolved_count} unresolved{h.reopened_count ? `, ${h.reopened_count} reopened` : ''})
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-0.5 rounded-lg border border-rose-200/80 dark:border-rose-900/40">
                    {h.high_critical_count} critical
                  </span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400">
                <p className="text-xs font-medium">No active hotspot corridors identified.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Complaints */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Recent Complaints Queue
            </h3>
            <button
              onClick={onNavigateToReports}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 font-medium cursor-pointer transition-colors"
            >
              <span>Full Queue</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800 flex-1">
            {complaints.length > 0 ? (
              complaints.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  onClick={() => onSelectComplaint(c)}
                  className="py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300">
                      <ProblemIcon type={c.problem_type} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-200">
                          {c.report_id}
                        </span>
                        <StatusBadge status={c.status} size="sm" />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px] sm:max-w-[240px]">
                        {c.location_name}
                      </p>
                    </div>
                  </div>

                  <SeverityBadge severity={c.severity} size="sm" />
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400">
                <p className="text-xs font-medium">
                  {isZeroData ? 'No civic reports yet' : 'No complaints match the filter criteria.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Problem Distribution */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Incident Category Breakdown
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">
              Live Volume
            </span>
          </div>

          <div className="h-56 mt-4">
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="name" stroke={chartTheme.tick} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={chartTheme.tick} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartTheme.tooltipBg,
                      borderColor: chartTheme.tooltipBorder,
                      color: chartTheme.tooltipColor,
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06)',
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={categoryColors[entry.key] || '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No categorical data available.
              </div>
            )}
          </div>
        </div>

        {/* Phase 8 Time-Based Analytics */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  Time-Based Operational Analytics
                </h3>
              </div>
              <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs">
                {[
                  { key: 'received', label: 'Received' },
                  { key: 'resolved', label: 'Resolved' },
                  { key: 'reopened', label: 'Reopened' },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTimeMetricView(t.key as any)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                      timeMetricView === t.key
                        ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 font-bold shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Turnaround Quick Indicators */}
            <div className="grid grid-cols-2 gap-2 mt-3 mb-2">
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px]">
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Avg Response Time</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {timeAnalytics?.avg_response_hours != null
                    ? `${timeAnalytics.avg_response_hours}h`
                    : <span className="text-slate-400 font-normal">Awaiting response records</span>}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px]">
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Avg Resolution Turnaround</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {timeAnalytics?.avg_resolution_hours != null
                    ? `${timeAnalytics.avg_resolution_hours}h`
                    : <span className="text-slate-400 font-normal">No resolved cases</span>}
                </span>
              </div>
            </div>
          </div>

          <div className="h-44 mt-2">
            {(activeTimePoints?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activeTimePoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="timeCurveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={activeCurveColor} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={activeCurveColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="day_label" stroke={chartTheme.tick} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={chartTheme.tick} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartTheme.tooltipBg,
                      borderColor: chartTheme.tooltipBorder,
                      color: chartTheme.tooltipColor,
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06)',
                    }}
                    labelFormatter={(val, items) => {
                      const item = items[0]?.payload;
                      return item?.date ? `${val} (${item.date})` : val;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={activeCurveColor}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#timeCurveGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No time-series data recorded for selected view.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
