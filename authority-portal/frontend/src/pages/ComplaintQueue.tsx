import React, { useState } from 'react';
import { ArrowUpDown, Eye, Inbox, MapPin, ArrowRight } from 'lucide-react';
import type { Complaint, Department } from '../types/complaint';
import { downloadComplaintsCsv } from '../services/api';
import { FilterBar } from '../components/FilterBar';
import { ProblemIcon, getProblemLabel } from '../components/ProblemIcon';
import { StatusBadge } from '../components/StatusBadge';
import { SeverityBadge } from '../components/SeverityBadge';
import { PriorityBadge } from '../components/PriorityBadge';

type SortField = 'created_at' | 'severity' | 'status' | 'report_id' | 'priority';
type SortOrder = 'asc' | 'desc';

interface ComplaintQueueProps {
  complaints: Complaint[];
  departments: Department[];
  loading: boolean;
  onSelectComplaint: (c: Complaint) => void;
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
}

export const ComplaintQueue: React.FC<ComplaintQueueProps> = ({
  complaints,
  departments,
  loading,
  onSelectComplaint,
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
}) => {
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      await downloadComplaintsCsv({
        problem_type: categoryFilter || undefined,
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        department: departmentFilter || undefined,
        resolution_status: resolutionStatusFilter || undefined,
        priority_level: priorityLevelFilter || undefined,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to export CSV file.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const severityWeight: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  const sortedComplaints = [...complaints].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'created_at') {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sortField === 'severity') {
      comparison = (severityWeight[a.severity] || 0) - (severityWeight[b.severity] || 0);
    } else if (sortField === 'priority') {
      comparison = (a.priority_score ?? 0) - (b.priority_score ?? 0);
    } else if (sortField === 'status') {
      comparison = a.status.localeCompare(b.status);
    } else if (sortField === 'report_id') {
      comparison = a.report_id.localeCompare(b.report_id);
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto transition-colors">
      {/* Title & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Municipal Complaint Queue
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Official triage and audit register for citizen-reported civic infrastructure defects.
          </p>
        </div>
        <span className="text-xs text-slate-600 dark:text-slate-300 font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1 rounded-lg shadow-xs">
          {sortedComplaints.length} Records
        </span>
      </div>

      {/* Filter Bar */}
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
        isExporting={isExporting}
      />

      {/* Triage Register (Responsive Table & Mobile Cards) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        {sortedComplaints.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
              <Inbox className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {loading ? 'Loading civic reports...' : 'No civic reports yet'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              As citizens submit civic complaints through the portal, they will appear here for authority triage and dispatch.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (md and up) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                    <th className="py-3 px-4">
                      <button
                        onClick={() => handleSort('report_id')}
                        className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer font-semibold uppercase text-[10px] tracking-wider"
                      >
                        <span>Report ID</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4 uppercase text-[10px] tracking-wider font-semibold">Incident Type</th>
                    <th className="py-3 px-4 uppercase text-[10px] tracking-wider font-semibold">Location / Ward</th>
                    <th className="py-3 px-4 uppercase text-[10px] tracking-wider font-semibold">Department</th>
                    <th className="py-3 px-4">
                      <button
                        onClick={() => handleSort('priority')}
                        className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer font-semibold uppercase text-[10px] tracking-wider"
                      >
                        <span>Priority</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        onClick={() => handleSort('severity')}
                        className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer font-semibold uppercase text-[10px] tracking-wider"
                      >
                        <span>Severity</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer font-semibold uppercase text-[10px] tracking-wider"
                      >
                        <span>Status</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        onClick={() => handleSort('created_at')}
                        className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer font-semibold uppercase text-[10px] tracking-wider"
                      >
                        <span>Reported</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right uppercase text-[10px] tracking-wider font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedComplaints.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => onSelectComplaint(c)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {c.report_id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300">
                            <ProblemIcon type={c.problem_type} className="w-3.5 h-3.5" />
                          </div>
                          <span className="capitalize font-medium text-slate-800 dark:text-slate-200">
                            {getProblemLabel(c.problem_type)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={c.location_name}>
                        {c.location_name || 'City Coordinates'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        <span className="font-medium text-slate-800 dark:text-slate-200 block">{c.department || 'Unassigned'}</span>
                        {c.assigned_to ? (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium truncate block max-w-[150px]">
                            👤 {c.assigned_to}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 italic block">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <PriorityBadge
                          level={c.priority_level}
                          score={c.priority_score}
                          size="sm"
                        />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <SeverityBadge severity={c.severity} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={c.status} size="sm" />
                          {c.status === 'RESOLVED' && c.citizen_verification_status === 'PENDING' && (
                            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                              Awaiting Citizen
                            </span>
                          )}
                          {c.citizen_verification_status === 'CONFIRMED' && (
                            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              ✓ Confirmed
                            </span>
                          )}
                          {(c.status === 'REOPENED' || c.citizen_verification_status === 'REOPENED') && (
                            <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400">
                              ⚠ Reopened
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                        {new Date(c.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectComplaint(c);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:white bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (under md) with Quick Sort Toolbar */}
            <div className="md:hidden">
              {/* Quick Sort Bar for Mobile */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1 overflow-x-auto text-[11px]">
                <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0 mr-1">
                  Sort:
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(
                    [
                      { field: 'priority' as SortField, label: 'Priority', ariaLabel: 'Order by urgency level' },
                      { field: 'severity' as SortField, label: 'Severity', ariaLabel: 'Order by severity grade' },
                      { field: 'status' as SortField, label: 'Status', ariaLabel: 'Order by lifecycle status' },
                      { field: 'created_at' as SortField, label: 'Date', ariaLabel: 'Order by submission date' },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.field}
                      type="button"
                      aria-label={s.ariaLabel}
                      onClick={() => handleSort(s.field)}
                      className={`px-2 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer touch-manipulation ${
                        sortField === s.field
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <span>{s.label}</span>
                      {sortField === s.field && (
                        <span className="text-[9px] font-mono">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Individual Compact Complaint Cards */}
              <div className="p-3 space-y-3">
                {sortedComplaints.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => onSelectComplaint(c)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs transition-colors cursor-pointer space-y-3 touch-manipulation"
                  >
                    {/* Top Row: Incident Title & Severity/Priority Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-700 dark:text-slate-300">
                          <ProblemIcon type={c.problem_type} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 capitalize truncate leading-snug">
                            {getProblemLabel(c.problem_type)}
                          </h4>
                          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                            {c.report_id}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <PriorityBadge level={c.priority_level} score={c.priority_score} size="xs" />
                        <SeverityBadge severity={c.severity} size="sm" />
                      </div>
                    </div>

                    {/* Location & Department */}
                    <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{c.location_name || 'City Coordinates'}</span>
                      </div>
                      {c.department && (
                        <div className="text-[11px] text-slate-400 pl-5 truncate">
                          Dept: <span className="text-slate-700 dark:text-slate-300 font-medium">{c.department}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Status Badge & View Details Action */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <StatusBadge status={c.status} size="sm" />
                        {c.status === 'RESOLVED' && c.citizen_verification_status === 'PENDING' && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            Awaiting Citizen
                          </span>
                        )}
                        {c.citizen_verification_status === 'CONFIRMED' && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            ✓ Confirmed
                          </span>
                        )}
                        {(c.status === 'REOPENED' || c.citizen_verification_status === 'REOPENED') && (
                          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                            ⚠ Reopened
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                        <span>View Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
