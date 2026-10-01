import React, { useState } from 'react';
import {
  Phone,
  Mail,
  FileQuestion,
  Building2,
  ChevronDown,
  Search,
  Copy,
  Check,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export const HelpSupport: React.FC = () => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<number, 'yes' | 'no'>>({});

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const FAQS = [
    {
      q: t('help.faq_q1', 'How does NagarDrishti AI verify and categorize my report?'),
      a: t('help.faq_a1', 'When you upload a photo, NagarDrishti’s on-device and edge AI models analyze the photographic evidence to identify the civic issue (pothole, garbage, streetlight, waterlogging), estimate visual severity, and extract GPS coordinates to route the complaint directly to the responsible municipal department.'),
      tags: ['ai', 'verification', 'category'],
    },
    {
      q: t('help.faq_q2', 'What is automatic duplicate detection?'),
      a: t('help.faq_a2', 'If multiple citizens report the same civic issue in the same vicinity within a short timeframe, NagarDrishti’s geospatial clustering clusters them into a single primary municipal case. This prevents redundant work orders and aggregates citizen priority.'),
      tags: ['duplicate', 'cluster', 'priority'],
    },
    {
      q: t('help.faq_q3', 'Can I track resolution progress without an account?'),
      a: t('help.faq_a3', 'Yes! Every complaint receives a public reference ID (e.g. ND-2026-XXXX). Anyone can use the "Track Status" tab with this ID to view the full resolution timeline, inspection notes, and before-and-after photographic evidence.'),
      tags: ['tracking', 'id', 'progress'],
    },
    {
      q: t('help.faq_q4', 'What happens if a resolved issue recurs or was not fixed properly?'),
      a: t('help.faq_a4', 'Citizens have the right to reopen a complaint within 7 days of resolution if the physical repair was inadequate. Simply open your complaint dossier in "My Reports" and submit a reopening request with follow-up photos for municipal reinspection.'),
      tags: ['reopen', 'resolved', 'quality'],
    },
  ];

  const filteredFaqs = FAQS.filter(
    (faq) =>
      faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.a.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 font-sans select-none max-w-4xl mx-auto pb-4 lg:pb-6 animate-fade-slide-up">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t('help.title', 'Help & Citizen Support')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('help.subtitle', 'Official helplines, municipal FAQs, and guidance for civic reporting.')}
          </p>
        </div>

        {/* Emergency SOS Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
          <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-semibold">Civic Emergency: Dial 1913</span>
        </div>
      </div>

      {/* Interactive Emergency & Municipal Helplines Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Helpline 1 */}
        <div
          onClick={() => copyToClipboard('1913', '1913')}
          className="bg-white/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-2.5 hover:-translate-y-0.5 transition-all cursor-pointer group relative overflow-hidden"
          title={t('help.click_to_copy', 'Click to copy')}
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 flex items-center justify-center">
              <Phone size={16} />
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {copiedKey === '1913' ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                  <Check size={11} /> {t('help.copied', 'Copied!')}
                </span>
              ) : (
                <span className="flex items-center gap-0.5">
                  <Copy size={11} /> Copy
                </span>
              )}
            </span>
          </div>
          <div>
            <div className="font-bold text-xs text-slate-900 dark:text-slate-100">{t('help.helpline_title', 'Municipal Central Helpline')}</div>
            <div className="text-2xl font-black font-mono text-[#0B2545] dark:text-blue-400 tracking-tight mt-0.5">1913</div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{t('help.helpline_desc', 'Toll-free 24x7 municipal assistance across all wards')}</div>
        </div>

        {/* Helpline 2 */}
        <div
          onClick={() => copyToClipboard('14420', '14420')}
          className="bg-white/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-2.5 hover:-translate-y-0.5 transition-all cursor-pointer group relative overflow-hidden"
          title={t('help.click_to_copy', 'Click to copy')}
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Building2 size={16} />
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {copiedKey === '14420' ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                  <Check size={11} /> {t('help.copied', 'Copied!')}
                </span>
              ) : (
                <span className="flex items-center gap-0.5">
                  <Copy size={11} /> Copy
                </span>
              )}
            </span>
          </div>
          <div>
            <div className="font-bold text-xs text-slate-900 dark:text-slate-100">{t('help.swachhata_title', 'Swachhata Sanitation Helpline')}</div>
            <div className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400 tracking-tight mt-0.5">14420</div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{t('help.swachhata_desc', 'Direct line for solid waste, garbage dumping, and sanitation')}</div>
        </div>

        {/* Helpline 3 */}
        <div
          onClick={() => copyToClipboard('support@nagardrishti.gov.in', 'email')}
          className="bg-white/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-xs space-y-2.5 hover:-translate-y-0.5 transition-all cursor-pointer group relative overflow-hidden"
          title={t('help.click_to_copy', 'Click to copy')}
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <Mail size={16} />
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {copiedKey === 'email' ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                  <Check size={11} /> {t('help.copied', 'Copied!')}
                </span>
              ) : (
                <span className="flex items-center gap-0.5">
                  <Copy size={11} /> Copy
                </span>
              )}
            </span>
          </div>
          <div>
            <div className="font-bold text-xs text-slate-900 dark:text-slate-100">{t('help.email_title', 'Official Grievance Email')}</div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 break-all font-mono mt-1">support@nagardrishti.gov.in</div>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{t('help.email_desc', 'For formal escalations, RTI inquiries, and developer access')}</div>
        </div>
      </div>

      {/* Interactive Frequently Asked Questions */}
      <div className="bg-white/90 dark:bg-slate-800/90 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-xs space-y-5 transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/80">
          <div className="flex items-center gap-2">
            <FileQuestion size={18} className="text-[#0B2545] dark:text-blue-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('help.faq_title', 'Frequently Asked Questions')}</h2>
          </div>

          {/* Interactive Search in FAQs */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('help.search_faq', 'Search questions or topics...')}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
            />
          </div>
        </div>

        {/* Accordion FAQ Items */}
        <div className="space-y-2.5">
          {filteredFaqs.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No matching questions found. Try searching for "duplicate", "tracking", or "AI".
            </div>
          ) : (
            filteredFaqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;

              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200/70 dark:border-slate-700/70 overflow-hidden transition-all bg-slate-50/50 dark:bg-slate-900/40"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                      {faq.q}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 space-y-3 animate-in fade-in duration-150">
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                        {faq.a}
                      </p>

                      {/* Interactive Feedback */}
                      <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Was this answer helpful?</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setFeedbackGiven({ ...feedbackGiven, [idx]: 'yes' })}
                            className={`p-1 px-2 rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                              feedbackGiven[idx] === 'yes'
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 text-emerald-600'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <ThumbsUp size={11} />
                            <span>Yes</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFeedbackGiven({ ...feedbackGiven, [idx]: 'no' })}
                            className={`p-1 px-2 rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                              feedbackGiven[idx] === 'no'
                                ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 text-rose-600'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <ThumbsDown size={11} />
                            <span>No</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
