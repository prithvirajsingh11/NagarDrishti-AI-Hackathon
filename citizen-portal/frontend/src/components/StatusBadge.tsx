import React from 'react';
import type { ComplaintStatus } from '../types/complaint';
import { useLanguage } from '../context/LanguageContext';

interface StatusBadgeProps {
  status: ComplaintStatus | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { t } = useLanguage();

  const getStyle = () => {
    switch (status?.toUpperCase()) {
      case 'REPORTED':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
      case 'ASSIGNED':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800';
      case 'IN_PROGRESS':
        return 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
      case 'RESOLVED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
      case 'REOPENED':
        return 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const getLabel = () => {
    switch (status?.toUpperCase()) {
      case 'REPORTED':
        return t('status.reported', 'Reported');
      case 'ASSIGNED':
        return t('status.assigned', 'Assigned');
      case 'IN_PROGRESS':
        return t('status.in_progress', 'In Progress');
      case 'RESOLVED':
        return t('status.resolved', 'Resolved');
      case 'REOPENED':
        return t('status.reopened', 'Reopened');
      default:
        return status;
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStyle()}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {getLabel()}
    </span>
  );
};
