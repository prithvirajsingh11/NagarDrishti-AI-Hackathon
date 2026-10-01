import React from 'react';
import type { SeverityLevel } from '../types/complaint';

interface SeverityBadgeProps {
  severity: SeverityLevel | string;
  size?: 'sm' | 'md';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, size = 'md' }) => {
  const norm = (severity || 'LOW').toUpperCase();

  const configs: Record<string, { label: string; cls: string }> = {
    LOW: {
      label: 'Low',
      cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700/60',
    },
    MEDIUM: {
      label: 'Medium',
      cls: 'bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/50',
    },
    HIGH: {
      label: 'High',
      cls: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50',
    },
    CRITICAL: {
      label: 'Critical',
      cls: 'bg-rose-50 text-rose-700 border-rose-200/80 font-medium dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50',
    },
  };

  const c = configs[norm] || configs.LOW;
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center rounded-md border font-normal tracking-wide transition-colors ${c.cls} ${padding}`}
    >
      {c.label}
    </span>
  );
};
