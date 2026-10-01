import React, { useState } from 'react';
import { Search, X, Download, SlidersHorizontal, Check } from 'lucide-react';
import type { Department } from '../types/complaint';

interface FilterBarProps {
  category: string;
  onCategoryChange: (val: string) => void;
  severity: string;
  onSeverityChange: (val: string) => void;
  status: string;
  onStatusChange: (val: string) => void;
  department: string;
  onDepartmentChange: (val: string) => void;
  resolutionStatus?: string;
  onResolutionStatusChange?: (val: string) => void;
  priorityLevel?: string;
  onPriorityLevelChange?: (val: string) => void;
  dateHorizon: string;
  onDateHorizonChange: (val: string) => void;
  search: string;
  onSearchChange: (val: string) => void;
  departments: Department[];
  onResetFilters: () => void;
  onExportCsv?: () => void;
  isExporting?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  category,
  onCategoryChange,
  severity,
  onSeverityChange,
  status,
  onStatusChange,
  department,
  onDepartmentChange,
  resolutionStatus = '',
  onResolutionStatusChange,
  priorityLevel = '',
  onPriorityLevelChange,
  dateHorizon,
  onDateHorizonChange,
  search,
  onSearchChange,
  departments,
  onResetFilters,
  onExportCsv,
  isExporting = false,
}) => {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeCount = [
    category,
    severity,
    status,
    department,
    resolutionStatus,
    priorityLevel,
    dateHorizon !== 'all' ? dateHorizon : '',
    search,
  ].filter(Boolean).length;

  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-xs space-y-2.5 transition-colors">
        {/* Mobile Filter Header (< md) */}
        <div className="md:hidden space-y-2">
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search reports..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Mobile Filters Modal Trigger */}
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors shrink-0 touch-manipulation cursor-pointer ${
                activeCount > 0
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeCount > 0 && (
                <span className="w-4.5 h-4.5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center font-mono">
                  {activeCount}
                </span>
              )}
            </button>
          </div>

          {/* Quick Date Horizon Pills + Reset for Mobile */}
          <div className="flex items-center justify-between gap-1 pt-0.5">
            <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-0.5 text-xs">
              {[
                { val: 'all', label: 'All' },
                { val: 'today', label: 'Today' },
                { val: '7d', label: '7D' },
                { val: '30d', label: '30D' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => onDateHorizonChange(item.val)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                    dateHorizon === item.val
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {activeCount > 0 && (
              <button
                type="button"
                onClick={onResetFilters}
                className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline px-1 py-0.5"
              >
                Reset All ({activeCount})
              </button>
            )}
          </div>
        </div>

        {/* Desktop Filter Row (md and up) */}
        <div className="hidden md:flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search report ID, location, details..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-colors"
            />
          </div>

          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            aria-label="Filter by problem category"
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-colors cursor-pointer"
          >
            <option value="">All Categories</option>
            <option value="pothole">Pothole</option>
            <option value="garbage">Garbage</option>
            <option value="streetlight">Streetlight</option>
            <option value="drain">Drainage</option>
            <option value="other">Other</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severity}
            onChange={(e) => onSeverityChange(e.target.value)}
            aria-label="Filter by severity level"
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-colors cursor-pointer"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Priority Level Filter */}
          <select
            value={priorityLevel}
            onChange={(e) => onPriorityLevelChange?.(e.target.value)}
            aria-label="Filter by priority level"
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-colors cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical Priority</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            aria-label="Filter by status"
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-colors cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="REPORTED">Reported</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="REOPENED">Reopened</option>
          </select>

          {/* Resolution Status Filter */}
          <select
            value={resolutionStatus}
            onChange={(e) => onResolutionStatusChange?.(e.target.value)}
            aria-label="Filter by resolution status"
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-colors cursor-pointer"
          >
            <option value="">All Resolutions</option>
            <option value="pending_resolution">Pending Resolution</option>
            <option value="resolved">Resolved</option>
            <option value="awaiting_verification">Awaiting Citizen Verification</option>
            <option value="citizen_confirmed">Citizen Confirmed</option>
            <option value="reopened">Reopened</option>
          </select>

          {/* Department Filter */}
          <select
            value={department}
            onChange={(e) => onDepartmentChange(e.target.value)}
            aria-label="Filter by department"
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 max-w-[160px] truncate transition-colors cursor-pointer"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Time Horizon Segmented Control */}
          <div className="flex items-center rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-0.5 text-xs">
            {[
              { val: 'all', label: 'All' },
              { val: 'today', label: 'Today' },
              { val: '7d', label: '7D' },
              { val: '30d', label: '30D' },
            ].map((item) => (
              <button
                key={item.val}
                type="button"
                onClick={() => onDateHorizonChange(item.val)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  dateHorizon === item.val
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Export Filtered CSV Button */}
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer ml-auto disabled:opacity-50 shadow-xs"
              title="Export filtered complaints as CSV"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          )}

          {/* Clear Filters Button */}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onResetFilters}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ${!onExportCsv ? 'ml-auto' : ''}`}
              title="Clear all active filters"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset ({activeCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Bottom-Sheet Filters Modal */}
      {mobileFiltersOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40 dark:bg-black/60 animate-in fade-in duration-150">
          <div className="flex-1" onClick={() => setMobileFiltersOpen(false)} />

          <div className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 rounded-t-2xl max-h-[85vh] flex flex-col shadow-xl animate-in slide-in-from-bottom duration-150 select-none">
            {/* Handle & Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Operational Filters
                </h3>
                {activeCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-semibold">
                    {activeCount} active
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close filters"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Filters Content */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Incident Category */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block uppercase tracking-wider text-[10px]">
                  Incident Category
                </label>
                <select
                  value={category}
                  onChange={(e) => onCategoryChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="">All Categories</option>
                  <option value="pothole">Pothole</option>
                  <option value="garbage">Garbage</option>
                  <option value="streetlight">Streetlight</option>
                  <option value="drain">Drainage</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Severity Level */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block uppercase tracking-wider text-[10px]">
                  Severity Level
                </label>
                <select
                  value={severity}
                  onChange={(e) => onSeverityChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              {/* Priority Level */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block uppercase tracking-wider text-[10px]">
                  Priority Index Level
                </label>
                <select
                  value={priorityLevel}
                  onChange={(e) => onPriorityLevelChange?.(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="">All Priorities</option>
                  <option value="CRITICAL">Critical Priority (≥70)</option>
                  <option value="HIGH">High Priority (50–69)</option>
                  <option value="MEDIUM">Medium Priority (30–49)</option>
                  <option value="LOW">Low Priority (&lt;30)</option>
                </select>
              </div>

              {/* Lifecycle Status */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block uppercase tracking-wider text-[10px]">
                  Lifecycle Status
                </label>
                <select
                  value={status}
                  onChange={(e) => onStatusChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="">All Statuses</option>
                  <option value="REPORTED">Reported</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="REOPENED">Reopened</option>
                </select>
              </div>

              {/* Resolution Status */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block uppercase tracking-wider text-[10px]">
                  Resolution & Verification
                </label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => onResolutionStatusChange?.(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="">All Resolutions</option>
                  <option value="pending_resolution">Pending Resolution</option>
                  <option value="resolved">Resolved</option>
                  <option value="awaiting_verification">Awaiting Citizen Verification</option>
                  <option value="citizen_confirmed">Citizen Confirmed</option>
                  <option value="reopened">Reopened</option>
                </select>
              </div>

              {/* Department */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block uppercase tracking-wider text-[10px]">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) => onDepartmentChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* CSV Export Button on Mobile */}
              {onExportCsv && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onExportCsv();
                      setMobileFiltersOpen(false);
                    }}
                    disabled={isExporting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>{isExporting ? 'Exporting CSV...' : 'Export Filtered CSV'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Sticky Sheet Bottom Actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onResetFilters();
                }}
                className="flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
              >
                Reset All
              </button>

              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Apply Filters</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
