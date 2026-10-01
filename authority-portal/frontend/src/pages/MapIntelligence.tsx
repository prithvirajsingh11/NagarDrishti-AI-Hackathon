import React from 'react';
import type {
  Complaint,
  Department,
  HeatmapPoint,
  HotspotInfo,
} from '../types/complaint';
import { LeafletMap, type MapMode } from '../components/LeafletMap';
import { FilterBar } from '../components/FilterBar';

interface MapIntelligenceProps {
  complaints: Complaint[];
  heatmapPoints: HeatmapPoint[];
  departments: Department[];
  hotspots: HotspotInfo[];
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  onSelectComplaint: (c: Complaint) => void;
  focusedHotspot: HotspotInfo | null;
  onSelectHotspot: (h: HotspotInfo | null) => void;
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

export const MapIntelligence: React.FC<MapIntelligenceProps> = ({
  complaints,
  heatmapPoints,
  departments,
  hotspots,
  mapMode,
  onMapModeChange,
  onSelectComplaint,
  focusedHotspot,
  onSelectHotspot,
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
  return (
    <div className="p-3 sm:p-6 space-y-3.5 sm:space-y-4 max-w-7xl mx-auto flex flex-col min-h-[calc(100vh-5rem)] md:h-[calc(100vh-4.5rem)] transition-colors">
      {/* Title & Hotspot quick selector */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shrink-0">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Geographic Map Intelligence
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Spatial distribution, density clusters, and high-risk thermal hotspots across municipal zones.
          </p>
        </div>

        {/* Hotspot Focus Quick Selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">Focus Corridor:</span>
          <select
            value={focusedHotspot ? focusedHotspot.title : ''}
            onChange={(e) => {
              const selected = hotspots.find((h) => h.title === e.target.value);
              onSelectHotspot(selected || null);
            }}
            aria-label="Focus on specific corridor hotspot"
            className="flex-1 sm:flex-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-colors cursor-pointer shadow-xs"
          >
            <option value="">Full City Overview</option>
            {hotspots.map((h, i) => (
              <option key={i} value={h.title}>
                {h.title} ({h.total_reports} reports)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="shrink-0">
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
        />
      </div>

      {/* Large Authority Map Viewport */}
      <div className="flex-1 min-h-[380px] rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-800">
        <LeafletMap
          complaints={complaints}
          heatmapPoints={heatmapPoints}
          hotspots={hotspots}
          mapMode={mapMode}
          onMapModeChange={onMapModeChange}
          onSelectComplaint={onSelectComplaint}
          focusedHotspot={focusedHotspot}
          heightClass="h-full"
        />
      </div>
    </div>
  );
};
