import React from 'react';
import {
  Flame,
  ArrowRight,
  Inbox,
} from 'lucide-react';
import type { Complaint, HotspotInfo } from '../types/complaint';
import { ProblemIcon, getProblemLabel } from '../components/ProblemIcon';

interface HotspotIntelligenceProps {
  hotspots: HotspotInfo[];
  allComplaints: Complaint[];
  onSelectHotspot: (h: HotspotInfo) => void;
  onNavigateToMap: () => void;
  onSelectComplaint: (c: Complaint) => void;
}

export const HotspotIntelligence: React.FC<HotspotIntelligenceProps> = ({
  hotspots,
  allComplaints,
  onSelectHotspot,
  onNavigateToMap,
  onSelectComplaint,
}) => {
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto transition-colors">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Hotspot Intelligence & Problem Corridors
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Spatial density clustering identifying high-risk recurring civic defects across municipal wards.
          </p>
        </div>
        <span className="text-xs text-slate-600 dark:text-slate-300 font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1 rounded-lg shadow-xs">
          {hotspots.length} Active Corridors
        </span>
      </div>

      {/* Hotspots Grid */}
      {hotspots.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center space-y-2 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
            <Inbox className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No active hotspot corridors identified
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
            As complaints are registered across the city, spatial density algorithms will surface high-risk problem zones automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {hotspots.map((h, idx) => {
            const related = allComplaints.filter((c) => {
              if (h.report_ids && h.report_ids.length > 0) {
                return h.report_ids.includes(c.id) || h.report_ids.includes(c.report_id);
              }
              if (c.latitude && c.longitude && h.latitude && h.longitude) {
                const dLat = Math.abs(c.latitude - h.latitude);
                const dLng = Math.abs(c.longitude - h.longitude);
                return dLat < 0.015 && dLng < 0.015;
              }
              return false;
            });

            return (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs group"
              >
                <div className="space-y-3.5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                        Corridor #{idx + 1}
                      </span>
                      <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                        {h.title}
                      </h3>
                      {h.affected_department && (
                        <span className="inline-block mt-1 text-[10px] text-blue-700 dark:text-blue-300 font-medium">
                          Dept: {h.affected_department}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300">
                        <ProblemIcon type={h.dominant_issue} className="w-3.5 h-3.5 text-slate-500" />
                        <span className="capitalize">{getProblemLabel(h.dominant_issue)}</span>
                      </div>
                      {h.trend && (
                        <span className="text-[10px] font-mono text-slate-500 capitalize">
                          Trend: {h.trend}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metrics 4-box */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-normal">Reports</span>
                      <span className="font-mono text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {h.total_reports}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-normal">Unresolved</span>
                      <span className="font-mono text-xs sm:text-sm font-semibold text-amber-700 dark:text-amber-400">
                        {h.unresolved_count}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-rose-700 dark:text-rose-400 block font-normal">Critical</span>
                      <span className="font-mono text-xs sm:text-sm font-semibold text-rose-700 dark:text-rose-400">
                        {h.high_critical_count}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-purple-700 dark:text-purple-400 block font-normal">Reopened</span>
                      <span className="font-mono text-xs sm:text-sm font-semibold text-purple-700 dark:text-purple-400">
                        {h.reopened_count ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* Severity Distribution if present */}
                  {h.severity_distribution && Object.keys(h.severity_distribution).length > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Severity:</span>
                      {Object.entries(h.severity_distribution).map(([sev, count]) => (
                        <span key={sev} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                          {sev}: {count}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Deterministic Recommended Action */}
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                      Recommended Municipal Action
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {h.suggested_action || 'Prioritize multi-crew inspection within corridor centroid.'}
                    </p>
                  </div>

                  {/* Related Reports Preview */}
                  {related.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-wider block">
                        Recent Incident In Corridor
                      </span>
                      <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/70">
                        <span className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                          {related[0].report_id}
                        </span>
                        <button
                          onClick={() => onSelectComplaint(related[0])}
                          className="text-[11px] text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">
                    Lat {h.latitude.toFixed(3)}, Lng {h.longitude.toFixed(3)}
                  </span>
                  <button
                    onClick={() => {
                      onSelectHotspot(h);
                      onNavigateToMap();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-950 text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
                  >
                    <span>View On Map</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
