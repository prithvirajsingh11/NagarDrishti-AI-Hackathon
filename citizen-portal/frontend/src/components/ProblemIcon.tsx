import React from 'react';
import { AlertCircle, Droplets, HelpCircle, Lightbulb, Trash2 } from 'lucide-react';
import type { ProblemType } from '../types/complaint';

interface ProblemIconProps {
  type: ProblemType;
  className?: string;
  size?: number;
}

export const ProblemIcon: React.FC<ProblemIconProps> = ({ type, className = '', size = 20 }) => {
  switch (type) {
    case 'pothole':
      return <AlertCircle size={size} className={`text-amber-600 ${className}`} />;
    case 'garbage':
      return <Trash2 size={size} className={`text-emerald-600 ${className}`} />;
    case 'streetlight':
      return <Lightbulb size={size} className={`text-yellow-500 ${className}`} />;
    case 'drain':
      return <Droplets size={size} className={`text-cyan-600 ${className}`} />;
    case 'other':
    default:
      return <HelpCircle size={size} className={`text-slate-500 ${className}`} />;
  }
};

export const getProblemLabel = (type: ProblemType, t?: (key: any) => string): string => {
  if (t) {
    switch (type) {
      case 'pothole':
        return t('problems.pothole');
      case 'garbage':
        return t('problems.garbage');
      case 'streetlight':
        return t('problems.streetlight');
      case 'drain':
        return t('problems.drain');
      case 'other':
      default:
        return t('problems.other');
    }
  }
  switch (type) {
    case 'pothole':
      return 'Pothole / Road Damage';
    case 'garbage':
      return 'Garbage Accumulation';
    case 'streetlight':
      return 'Damaged Streetlight';
    case 'drain':
      return 'Overflowing / Blocked Drain';
    case 'other':
    default:
      return 'Other / Unclear';
  }
};
