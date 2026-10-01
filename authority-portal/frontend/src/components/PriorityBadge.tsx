import React from 'react';
import type { PriorityLevel } from '../types/complaint';

interface PriorityBadgeProps {
  level?: PriorityLevel | string | null;
  score?: number | null;
  size?: 'xs' | 'sm' | 'md';
  showScore?: boolean;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  level,
  score,
  size = 'md',
  showScore = true,
}) => {
  const norm = (level || 'LOW').toUpperCase();

  const configs: Record<string, { label: string; cls: string; dotCls: string }> = {
    LOW: {
      label: 'Low Priority',
      cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700/60',
      dotCls: 'bg-slate-400',
    },
    MEDIUM: {
      label: 'Medium Priority',
      cls: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50',
      dotCls: 'bg-blue-500',
    },
    HIGH: {
      label: 'High Priority',
      cls: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
      dotCls: 'bg-amber-500',
    },
    CRITICAL: {
      label: 'Critical Priority',
      cls: 'bg-rose-50 text-rose-800 border-rose-300 font-semibold dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
      dotCls: 'bg-rose-600',
    },
  };

  const c = configs[norm] || configs.LOW;
  const padding = size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border font-medium tracking-tight transition-colors ${c.cls} ${padding}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dotCls}`} />
      <span>{c.label}</span>
      {showScore && score !== undefined && score !== null && (
        <span className="font-mono text-[10px] opacity-80 font-bold ml-0.5">
          ({Math.round(score)})
        </span>
      )}
    </span>
  );
};
