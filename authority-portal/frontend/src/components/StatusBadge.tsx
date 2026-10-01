import React from 'react';
import type { ComplaintStatus } from '../types/complaint';

interface StatusBadgeProps {
  status: ComplaintStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const norm = (status || 'REPORTED').toUpperCase();

  const configs: Record<string, { label: string; cls: string; dot: string }> = {
    REPORTED: {
      label: 'Reported',
      cls: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50',
      dot: 'bg-amber-500 dark:bg-amber-400',
    },
    ASSIGNED: {
      label: 'Assigned',
      cls: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50',
      dot: 'bg-blue-500 dark:bg-blue-400',
    },
    IN_PROGRESS: {
      label: 'In Progress',
      cls: 'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/50',
      dot: 'bg-indigo-500 dark:bg-indigo-400',
    },
    RESOLVED: {
      label: 'Resolved',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50',
      dot: 'bg-emerald-500 dark:bg-emerald-400',
    },
    REOPENED: {
      label: 'Reopened',
      cls: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50',
      dot: 'bg-rose-500 dark:bg-rose-400',
    },
  };

  const c = configs[norm] || configs.REPORTED;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border transition-colors ${c.cls} ${padding}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};
