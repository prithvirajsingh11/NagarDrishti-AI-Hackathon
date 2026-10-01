import React from 'react';
import { AlertCircle, AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { SeverityLevel } from '../types/complaint';
import { useLanguage } from '../context/LanguageContext';

interface SeverityBadgeProps {
  severity: SeverityLevel | string;
  showSubtitle?: boolean;
  size?: 'sm' | 'md';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  showSubtitle = false,
  size = 'md',
}) => {
  const { t } = useLanguage();
  const normalized = (severity || 'LOW').toUpperCase();

  const getStyle = () => {
    switch (normalized) {
      case 'CRITICAL':
        return {
          container: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 ring-rose-500/20',
          icon: <AlertOctagon size={size === 'sm' ? 10 : 12} className="text-rose-600 dark:text-rose-400 shrink-0" />,
          ariaLabel: 'Critical severity level',
          label: t('severity.critical', 'CRITICAL'),
        };
      case 'HIGH':
        return {
          container: 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800 ring-orange-500/20',
          icon: <AlertTriangle size={size === 'sm' ? 10 : 12} className="text-orange-600 dark:text-orange-400 shrink-0" />,
          ariaLabel: 'High severity level',
          label: t('severity.high', 'HIGH'),
        };
      case 'MEDIUM':
        return {
          container: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 ring-amber-500/20',
          icon: <AlertCircle size={size === 'sm' ? 10 : 12} className="text-amber-600 dark:text-amber-400 shrink-0" />,
          ariaLabel: 'Medium severity level',
          label: t('severity.medium', 'MEDIUM'),
        };
      case 'LOW':
      default:
        return {
          container: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 ring-emerald-500/20',
          icon: <CheckCircle2 size={size === 'sm' ? 10 : 12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />,
          ariaLabel: 'Low severity level',
          label: t('severity.low', 'LOW'),
        };
    }
  };

  const { container, icon, ariaLabel, label } = getStyle();

  return (
    <div className="inline-flex flex-col items-start">
      <span
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'
        } ${container}`}
        title="AI-estimated visual severity based on photographic evidence"
      >
        {icon}
        <span>{label}</span>
      </span>
      {showSubtitle && (
        <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 tracking-tight">
          AI-estimated visual severity
        </span>
      )}
    </div>
  );
};
