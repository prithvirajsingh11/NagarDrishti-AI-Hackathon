import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { HotspotInfo } from '../types/complaint';

interface RepeatedProblemBannerProps {
  hotspots: HotspotInfo[];
  onSelectHotspot: (h: HotspotInfo) => void;
}

export const RepeatedProblemBanner: React.FC<RepeatedProblemBannerProps> = ({
  hotspots,
  onSelectHotspot,
}) => {
  const primaryRepeated = hotspots.find(
    (h) => (h.repeated_count && h.repeated_count > 1) || h.total_reports >= 4
  );

  if (!primaryRepeated) return null;

  const count = primaryRepeated.repeated_count || primaryRepeated.total_reports;

  return (
    <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-900/50 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400">
              Repeated Pattern Detected
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[10px] font-medium">
              Corridor Cluster
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
            {count} {primaryRepeated.dominant_issue} reports clustered within {primaryRepeated.title}
          </p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
            Suggested action: {primaryRepeated.suggested_action}
          </p>
        </div>
      </div>

      <button
        onClick={() => onSelectHotspot(primaryRepeated)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 font-medium text-xs rounded-lg transition-colors shrink-0 shadow-xs"
      >
        <span>Inspect Corridor</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
