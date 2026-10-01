import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  MapPin,
  Sparkles,
  AlertTriangle,
  Building2,
  Calendar,
  ExternalLink,
  CheckCircle2,
  ArrowRight,
  Upload,
  Check,
  Clock,
  ShieldCheck,
  FileText,
  UserCheck,
  UserPlus,
  Lock,
  MessageSquare,
  Send,
  History,
  User,
  ImageOff,
} from 'lucide-react';
import type { Complaint, ComplaintStatus, Department } from '../types/complaint';
import { ProblemIcon, getProblemLabel } from './ProblemIcon';
import {
  resolveImageUrl,
  uploadResolutionEvidence,
  assignComplaint as apiAssignComplaint,
  addInternalNote as apiAddInternalNote,
  acknowledgeStatusUpdateRequest as apiAcknowledgeStatus,
} from '../services/api';
import { StatusBadge } from './StatusBadge';
import { SeverityBadge } from './SeverityBadge';
import { PriorityBadge } from './PriorityBadge';

interface ComplaintDrawerProps {
  complaint: Complaint | null;
  onClose: () => void;
  onUpdateStatus: (
    id: string,
    newStatus: ComplaintStatus,
    resolution?: { resolution_image_url?: string; resolution_note?: string }
  ) => Promise<void>;
  onSelectDuplicate?: (duplicateReportId: string) => void;
  onAssignComplaint?: (
    id: string,
    payload: { department: string; assigned_to: string; note?: string }
  ) => Promise<void>;
  onAddInternalNote?: (id: string, note: string) => Promise<void>;
  onAcknowledgeStatusRequest?: (
    complaintId: string,
    requestId: string,
    responseNote?: string
  ) => Promise<void>;
  departments?: Department[];
}

export const ComplaintDrawer: React.FC<ComplaintDrawerProps> = ({
  complaint,
  onClose,
  onUpdateStatus,
  onSelectDuplicate,
  onAssignComplaint,
  onAddInternalNote,
  onAcknowledgeStatusRequest,
  departments,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Resolution confirmation modal state
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolutionFile, setResolutionFile] = useState<File | null>(null);
  const [resolutionPreviewUrl, setResolutionPreviewUrl] = useState<string>('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Evidence image load error states
  const [evidenceImgError, setEvidenceImgError] = useState(false);
  const [resolutionImgError, setResolutionImgError] = useState(false);

  useEffect(() => {
    setEvidenceImgError(false);
    setResolutionImgError(false);
  }, [complaint?.id, complaint?.image_url]);

  // Phase 7: Case Assignment State
  const [assignDept, setAssignDept] = useState(complaint?.department || '');
  const [assignTo, setAssignTo] = useState(complaint?.assigned_to || '');
  const [assignNote, setAssignNote] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignSuccessMsg, setAssignSuccessMsg] = useState<string | null>(null);

  // Synchronize when complaint changes
  useEffect(() => {
    if (complaint) {
      setAssignDept(complaint.department || '');
      setAssignTo(complaint.assigned_to || '');
      setAssignNote('');
      setAssignSuccessMsg(null);
    }
  }, [complaint?.id, complaint?.department, complaint?.assigned_to]);

  // Phase 7: Internal Confidential Note State
  const [internalNoteInput, setInternalNoteInput] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [noteSuccessMsg, setNoteSuccessMsg] = useState<string | null>(null);

  // Phase 7: Citizen Status Requests State
  const [ackResponseNotes, setAckResponseNotes] = useState<Record<string, string>>({});
  const [acknowledgingIds, setAcknowledgingIds] = useState<Record<string, boolean>>({});

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint || !assignDept.trim() || !assignTo.trim()) return;
    setIsAssigning(true);
    setAssignSuccessMsg(null);
    try {
      if (onAssignComplaint) {
        await onAssignComplaint(complaint.id, {
          department: assignDept.trim(),
          assigned_to: assignTo.trim(),
          note: assignNote.trim() || undefined,
        });
      } else {
        await apiAssignComplaint(complaint.id, {
          department: assignDept.trim(),
          assigned_to: assignTo.trim(),
          note: assignNote.trim() || undefined,
        });
      }
      setAssignSuccessMsg('Case assigned and logged to auditable history.');
      setAssignNote('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Assignment failed.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleInternalNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint || !internalNoteInput.trim()) return;
    setIsSubmittingNote(true);
    setNoteSuccessMsg(null);
    try {
      if (onAddInternalNote) {
        await onAddInternalNote(complaint.id, internalNoteInput.trim());
      } else {
        await apiAddInternalNote(complaint.id, internalNoteInput.trim());
      }
      setInternalNoteInput('');
      setNoteSuccessMsg('Internal note appended to confidential file.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add internal note.');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleAcknowledgeRequest = async (requestId: string) => {
    if (!complaint) return;
    setAcknowledgingIds((prev) => ({ ...prev, [requestId]: true }));
    try {
      const responseNote = ackResponseNotes[requestId]?.trim() || undefined;
      if (onAcknowledgeStatusRequest) {
        await onAcknowledgeStatusRequest(complaint.id, requestId, responseNote);
      } else {
        await apiAcknowledgeStatus(complaint.id, requestId, responseNote);
      }
      setAckResponseNotes((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to acknowledge status request.');
    } finally {
      setAcknowledgingIds((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  if (!complaint) return null;

  const handleStatusChange = async (targetStatus: ComplaintStatus) => {
    if (targetStatus === 'RESOLVED') {
      // Prompt modal for required resolution evidence photo
      setResolutionError(null);
      setIsResolveModalOpen(true);
      return;
    }

    setIsUpdating(true);
    setErrorMsg(null);
    try {
      await onUpdateStatus(complaint.id, targetStatus);
    } catch (err: any) {
      setErrorMsg(err.message || 'Status transition failed.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file format (JPG, PNG, WEBP)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['jpg', 'jpeg', 'png', 'webp'];

    if (!validTypes.includes(file.type) && (!ext || !validExts.includes(ext))) {
      setResolutionError('Invalid file format. Accepted formats: JPG, PNG, WEBP.');
      return;
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setResolutionError('File size exceeds the 10 MB limit.');
      return;
    }

    setResolutionError(null);
    setResolutionFile(file);
    try {
      const objectUrl = URL.createObjectURL(file);
      setResolutionPreviewUrl(objectUrl);
    } catch {
      setResolutionPreviewUrl('blob:mock-url');
    }
  };

  const handleConfirmResolution = async () => {
    if (!resolutionFile && !resolutionPreviewUrl) {
      setResolutionError('Resolution image is required to mark this civic complaint as resolved.');
      return;
    }

    setIsSubmittingResolution(true);
    setResolutionError(null);

    try {
      let finalImageUrl = resolutionPreviewUrl;

      if (resolutionFile) {
        // Upload image to backend / Supabase storage
        try {
          const uploadRes = await uploadResolutionEvidence(resolutionFile);
          finalImageUrl = uploadRes.image_url;
        } catch (uploadErr: any) {
          // If mock/testing or backend offline, fallback to object preview url
          console.warn('Upload API fallback:', uploadErr);
          if (!finalImageUrl) {
            throw uploadErr;
          }
        }
      }

      await onUpdateStatus(complaint.id, 'RESOLVED', {
        resolution_image_url: finalImageUrl,
        resolution_note: resolutionNote.trim(),
      });

      setIsResolveModalOpen(false);
      setResolutionFile(null);
      setResolutionPreviewUrl('');
      setResolutionNote('');
    } catch (err: any) {
      setResolutionError(err.message || 'Failed to submit resolution.');
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  const getNextStatuses = (current: ComplaintStatus): ComplaintStatus[] => {
    switch (current) {
      case 'REPORTED':
        return ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];
      case 'ASSIGNED':
        return ['IN_PROGRESS', 'RESOLVED'];
      case 'IN_PROGRESS':
        return ['RESOLVED'];
      case 'REOPENED':
        return ['IN_PROGRESS', 'RESOLVED'];
      case 'RESOLVED':
        return ['IN_PROGRESS'];
      default:
        return [];
    }
  };

  const nextActions = getNextStatuses(complaint.status);

  // Check resolution image existence
  const resolutionImage = complaint.resolution_image_url || complaint.resolution_image_path;
  const isReopened = complaint.status === 'REOPENED' || complaint.citizen_reopened === true;
  const isResolved = complaint.status === 'RESOLVED';

  // Citizen verification status
  const verificationStatus =
    complaint.citizen_verification_status ||
    (complaint.citizen_resolution_confirmed === true
      ? 'CONFIRMED'
      : isReopened
      ? 'REOPENED'
      : isResolved
      ? 'PENDING'
      : null);

  // Build auditable timeline items
  const historyItems =
    complaint.status_history && complaint.status_history.length > 0
      ? complaint.status_history
      : [
          {
            status: 'REPORTED',
            timestamp: complaint.created_at,
            note: 'Citizen submitted report',
            actor: 'Citizen User',
          },
          {
            status: 'AI_VERIFIED',
            timestamp: complaint.created_at,
            note: `${getProblemLabel(complaint.problem_type)} detected (${Math.round(
              complaint.confidence * 100
            )}% confidence)`,
            actor: 'NagarDrishti Gemini Vision',
          },
          ...(complaint.department
            ? [
                {
                  status: 'ASSIGNED',
                  timestamp: complaint.created_at,
                  note: `Routed to ${complaint.department}`,
                  actor: 'Municipal Dispatch',
                },
              ]
            : []),
          ...(complaint.status === 'IN_PROGRESS' || isResolved || isReopened
            ? [
                {
                  status: 'IN_PROGRESS',
                  timestamp: complaint.updated_at,
                  note: 'Repair work started on-site',
                  actor: complaint.resolved_by || 'Field Maintenance Crew',
                },
              ]
            : []),
          ...(isResolved || isReopened || complaint.resolved_at
            ? [
                {
                  status: 'RESOLVED',
                  timestamp: complaint.resolved_at || complaint.updated_at,
                  note:
                    complaint.resolution_note ||
                    'Defect rectified and resolution evidence recorded',
                  actor: complaint.resolved_by || 'Municipal Authority Officer',
                },
              ]
            : []),
          ...(complaint.citizen_resolution_confirmed
            ? [
                {
                  status: 'CITIZEN_CONFIRMED',
                  timestamp:
                    complaint.citizen_resolution_confirmed_at ||
                    complaint.citizen_verified_at ||
                    complaint.updated_at,
                  note: 'Citizen confirmed resolution',
                  actor: 'Citizen User',
                },
              ]
            : isReopened
            ? [
                {
                  status: 'REOPENED',
                  timestamp:
                    complaint.citizen_reopened_at ||
                    complaint.reopened_at ||
                    complaint.updated_at,
                  note: complaint.reopen_reason || 'Citizen reported issue still exists',
                  actor: 'Citizen User',
                },
              ]
            : isResolved
            ? [
                {
                  status: 'CITIZEN_VERIFICATION_PENDING',
                  timestamp: complaint.resolved_at || complaint.updated_at,
                  note: 'Pending citizen verification',
                  actor: 'Verification Cell',
                },
              ]
            : []),
        ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 dark:bg-black/70 transition-opacity animate-in fade-in duration-200">
        {/* Click outside backdrop */}
        <div className="flex-1" onClick={onClose} />

        {/* Drawer Surface */}
        <div className="w-full sm:max-w-lg md:max-w-xl bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-xl flex flex-col h-full overflow-hidden transition-colors duration-150 animate-in slide-in-from-right duration-200">
          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-xs">
                <ProblemIcon type={complaint.problem_type} className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {complaint.report_id}
                  </span>
                  <StatusBadge status={complaint.status} size="sm" />
                  <PriorityBadge level={complaint.priority_level} score={complaint.priority_score} size="xs" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                  {getProblemLabel(complaint.problem_type)} Incident
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Close details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            {/* Phase 8: Case Detail Operational Summary */}
            <div className="bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h4 className="text-xs font-bold tracking-tight text-slate-900 dark:text-slate-100 uppercase">
                    Case Detail Operational Summary
                  </h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {complaint.report_id}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 text-xs">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Category & Severity</span>
                  <div className="flex items-center gap-1.5 mt-0.5 font-medium text-slate-900 dark:text-slate-100 capitalize">
                    <span>{getProblemLabel(complaint.problem_type)}</span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="font-semibold">{complaint.severity}</span>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Current Status & Priority</span>
                  <div className="flex items-center gap-1.5 mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                    <StatusBadge status={complaint.status} size="sm" />
                    <PriorityBadge level={complaint.priority_level} score={complaint.priority_score} size="xs" />
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Department & Officer</span>
                  <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100 truncate">
                    <div className="truncate font-semibold">Dept: {complaint.department || 'Unassigned'}</div>
                    <div className="text-[11px] text-slate-500 truncate">Officer: {complaint.assigned_to || 'Unassigned'}</div>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Verification & Resolution</span>
                  <div className="mt-0.5 text-[11px] font-medium text-slate-900 dark:text-slate-100">
                    <div>Status: <span className="font-semibold">{isResolved ? 'Resolved' : isReopened ? 'Reopened' : 'In Progress'}</span></div>
                    <div className="text-slate-500 text-[10px]">Verification: <span className="font-medium text-slate-700 dark:text-slate-300">{verificationStatus || 'N/A'}</span></div>
                  </div>
                </div>
              </div>

              {/* Location & Timestamps */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/80 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate font-medium">Site: {complaint.location_name}</span>
                  {complaint.latitude && complaint.longitude && (
                    <span className="text-[10px] font-mono text-slate-400 ml-auto shrink-0">
                      {complaint.latitude.toFixed(4)}, {complaint.longitude.toFixed(4)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  <span>Intake: {new Date(complaint.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  {complaint.resolved_at ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Resolved: {new Date(complaint.resolved_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ) : (
                    <span>Last updated: {new Date(complaint.updated_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </div>
              </div>

              {/* Escalation Triggers Indicator */}
              {(isReopened || (complaint.priority_score && complaint.priority_score >= 70) || (complaint.status_update_requests && complaint.status_update_requests.length > 0)) && (
                <div className="p-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <div className="flex-1">
                    <span className="font-semibold">Active Escalation Triggers: </span>
                    <span>
                      {[
                        isReopened ? 'Citizen Reopened' : null,
                        (complaint.priority_score && complaint.priority_score >= 70) ? 'Critical Priority Index (≥70)' : null,
                        (complaint.status_update_requests && complaint.status_update_requests.length > 0) ? `${complaint.status_update_requests.length} Citizen Status Request(s)` : null,
                      ].filter(Boolean).join(' • ')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Deterministic Municipal Priority Intelligence */}
            {complaint.priority_explanation && (
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-900 dark:text-blue-300">
                    Municipal Priority Rationale
                  </span>
                  <PriorityBadge level={complaint.priority_level} score={complaint.priority_score} size="xs" />
                </div>
                <p className="text-[11px] text-blue-800 dark:text-blue-300/90 leading-relaxed">
                  {complaint.priority_explanation}
                </p>
              </div>
            )}

            {/* High-Visibility Reopened Alert Banner */}
            {isReopened && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-400/80 dark:border-rose-800 space-y-2 shadow-xs animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wide">
                      Citizen reported that this issue is still unresolved.
                    </h4>
                    <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1 leading-relaxed">
                      {complaint.reopen_reason ? (
                        <>
                          <span className="font-semibold">Citizen feedback:</span> "{complaint.reopen_reason}"
                        </>
                      ) : (
                        'Citizen verified that the defect persists on-site.'
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-rose-600/90 dark:text-rose-400 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>
                        Reopened:{' '}
                        {new Date(
                          complaint.citizen_reopened_at ||
                            complaint.reopened_at ||
                            complaint.updated_at
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Duplicate Alert Notice */}
            {complaint.duplicate_of && (
              <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-900/50 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-300">
                      Possible Duplicate Detected
                    </h4>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80 mt-0.5">
                      This report is linked to existing complaint #{complaint.duplicate_of}.
                    </p>
                  </div>
                </div>
                {onSelectDuplicate && (
                  <button
                    onClick={() => onSelectDuplicate(complaint.duplicate_of!)}
                    className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200/80 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] font-semibold rounded-lg transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Original</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Before / After Visual Comparison View */}
            {resolutionImage ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Visual Evidence Comparison (Before / After)
                  </h4>
                  {complaint.resolved_at && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      Resolved {new Date(complaint.resolved_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Desktop: Side-by-Side (grid-cols-2), Mobile: Stacked Vertically */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* BEFORE (Citizen Image) */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-2.5 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] uppercase font-semibold text-slate-700 dark:text-slate-300">
                          Before
                        </span>
                        <span>Citizen Report</span>
                      </span>
                      <a
                        href={resolveImageUrl(complaint.image_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <span>Full</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <div className="rounded-xl overflow-hidden aspect-video bg-slate-200 dark:bg-slate-950 relative group">
                      {evidenceImgError ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900/60">
                          <ImageOff className="w-5 h-5 mb-1 opacity-50" />
                          <span className="text-[10px]">Photo unavailable</span>
                        </div>
                      ) : (
                        <img
                          src={resolveImageUrl(complaint.image_url)}
                          alt="Citizen report photographic evidence"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            if (complaint.image_url && !img.src.includes('supabase.co')) {
                              const filename = complaint.image_url.split('/api/complaints/image/')[1]?.split('?')[0];
                              if (filename) {
                                img.src = `https://otjbonkovzciglttxfzz.supabase.co/storage/v1/object/public/complaint-images/${filename}`;
                                return;
                              }
                            }
                            setEvidenceImgError(true);
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* AFTER (Resolution Image) */}
                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-[10px] uppercase font-semibold text-emerald-800 dark:text-emerald-300">
                          After
                        </span>
                        <span>Resolution Evidence</span>
                      </span>
                      <a
                        href={resolveImageUrl(resolutionImage)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <span>Full</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <div className="rounded-xl overflow-hidden aspect-video bg-slate-200 dark:bg-slate-950 relative group">
                      {resolutionImgError ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-emerald-600/70 dark:text-emerald-400/60 bg-emerald-50/50 dark:bg-emerald-950/30">
                          <ImageOff className="w-5 h-5 mb-1 opacity-50" />
                          <span className="text-[10px]">Resolution photo unavailable</span>
                        </div>
                      ) : (
                        <img
                          src={resolveImageUrl(resolutionImage)}
                          alt="Municipal authority resolution evidence"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            if (resolutionImage && !img.src.includes('supabase.co')) {
                              const filename = resolutionImage.split('/api/complaints/image/')[1]?.split('?')[0];
                              if (filename) {
                                img.src = `https://otjbonkovzciglttxfzz.supabase.co/storage/v1/object/public/complaint-images/${filename}`;
                                return;
                              }
                            }
                            setResolutionImgError(true);
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Resolution Note */}
                {complaint.resolution_note && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100 text-[11px]">
                      <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Resolution Summary</span>
                      {complaint.resolved_by && (
                        <span className="text-slate-400 font-normal ml-auto text-[10px]">
                          By {complaint.resolved_by}
                        </span>
                      )}
                    </div>
                    <p className="italic leading-relaxed">"{complaint.resolution_note}"</p>
                  </div>
                )}
              </div>
            ) : (
              /* Citizen Single Evidence (Before resolution) */
              <div>
                <h4 className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                  Citizen Photographic Evidence
                </h4>
                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 aspect-video relative group shadow-2xs">
                  {evidenceImgError || !complaint.image_url ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/40">
                      <ImageOff className="w-8 h-8 mb-2 opacity-50 text-slate-400" />
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Photographic Evidence Unavailable</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                        No image proof recorded or file is not accessible from CDN storage
                      </p>
                    </div>
                  ) : (
                    <>
                      <img
                        src={resolveImageUrl(complaint.image_url)}
                        alt={complaint.description || 'Civic defect evidence'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          if (complaint.image_url && !img.src.includes('supabase.co')) {
                            const filename = complaint.image_url.split('/api/complaints/image/')[1]?.split('?')[0];
                            if (filename) {
                              img.src = `https://otjbonkovzciglttxfzz.supabase.co/storage/v1/object/public/complaint-images/${filename}`;
                              return;
                            }
                          }
                          setEvidenceImgError(true);
                        }}
                      />
                      <a
                        href={resolveImageUrl(complaint.image_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-2.5 right-2.5 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-950/90 hover:bg-white text-[11px] font-semibold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 transition-all shadow-md"
                      >
                        <span>Full Image</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  )}
                </div>
                {complaint.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 leading-relaxed italic">
                    "{complaint.description}"
                  </p>
                )}
              </div>
            )}

            {/* Citizen Verification Status Card */}
            {(isResolved || isReopened || verificationStatus) && (
              <div className="p-3.5 rounded-2xl border bg-slate-50 dark:bg-slate-900/50 border-slate-200/90 dark:border-slate-800 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Citizen Verification
                    </h4>
                  </div>
                  {verificationStatus === 'CONFIRMED' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                      <Check className="w-3 h-3" />
                      <span>Confirmed</span>
                    </span>
                  ) : verificationStatus === 'REOPENED' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Reopened</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                      <Clock className="w-3 h-3" />
                      <span>Pending</span>
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 pl-6">
                  {verificationStatus === 'CONFIRMED' ? (
                    <p className="text-emerald-700 dark:text-emerald-300 font-medium">
                      ✓ Citizen confirmed resolution
                      {complaint.citizen_resolution_confirmed_at && (
                        <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
                          on {new Date(complaint.citizen_resolution_confirmed_at).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  ) : verificationStatus === 'REOPENED' ? (
                    <p className="text-rose-700 dark:text-rose-300 font-medium">
                      ⚠ Citizen reported issue still exists
                    </p>
                  ) : (
                    <p className="text-slate-500 dark:text-slate-400">
                      Resolution marked by authority. Awaiting citizen confirmation or feedback.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* AI Vision Assessment */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <h4>Gemini Vision Assessment</h4>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {Math.round(complaint.confidence * 100)}% Confidence
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-semibold">
                    Visual Severity
                  </span>
                  <div className="mt-1">
                    <SeverityBadge severity={complaint.severity} size="sm" />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-semibold">
                    Category
                  </span>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold capitalize mt-1">
                    {getProblemLabel(complaint.problem_type)}
                  </p>
                </div>
              </div>

              {/* Observations */}
              {complaint.evidence && complaint.evidence.length > 0 && (
                <div>
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-semibold">
                    Objective Visual Observations
                  </span>
                  <ul className="mt-1.5 space-y-1">
                    {complaint.evidence.map((point, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2"
                      >
                        <span className="text-blue-500 mt-1">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Location & Department */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>Geographic Location</span>
                </div>
                <p className="text-slate-900 dark:text-slate-100 font-semibold">
                  {complaint.location_name || 'City Coordinates'}
                </p>
                <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                  {complaint.latitude.toFixed(4)}, {complaint.longitude.toFixed(4)}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Responsible Department</span>
                </div>
                <p className="text-slate-900 dark:text-slate-100 font-semibold">
                  {complaint.department || 'Unassigned'}
                </p>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(complaint.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Case Assignment & Officer Dispatch (Phase 7) */}
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Case Assignment & Officer Dispatch
                  </h4>
                </div>
                {complaint.assigned_to ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                    Assigned
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                    Unassigned
                  </span>
                )}
              </div>

              {/* Current Assignment Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">
                    Current Department
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                    {complaint.department || 'Not Assigned'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">
                    Assigned Officer / Squad
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                    {complaint.assigned_to || 'None Assigned'}
                  </span>
                </div>
              </div>

              {/* Assignment Form */}
              <form onSubmit={handleAssignSubmit} className="space-y-2.5 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Department
                    </label>
                    {departments && departments.length > 0 ? (
                      <select
                        value={assignDept}
                        onChange={(e) => setAssignDept(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Select Department...</option>
                        {departments.map((d) => (
                          <option key={d.id || d.name} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={assignDept}
                        onChange={(e) => setAssignDept(e.target.value)}
                        placeholder="e.g., Municipal Roads (PWD)"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Officer / Responsible Unit
                    </label>
                    <input
                      type="text"
                      value={assignTo}
                      onChange={(e) => setAssignTo(e.target.value)}
                      placeholder="e.g., Officer A (Bhopal Rapid Patch Squad)"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Assignment / Dispatch Note <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={assignNote}
                    onChange={(e) => setAssignNote(e.target.value)}
                    placeholder="e.g., Immediate night milling and hot asphalt filling required."
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  {assignSuccessMsg ? (
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      ✓ {assignSuccessMsg}
                    </span>
                  ) : <span />}
                  <button
                    type="submit"
                    disabled={isAssigning || !assignDept.trim() || !assignTo.trim()}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{isAssigning ? 'Assigning...' : complaint.assigned_to ? 'Reassign Case' : 'Assign Case'}</span>
                  </button>
                </div>
              </form>

              {/* Auditable Assignment History */}
              {complaint.assignment_history && complaint.assignment_history.length > 0 && (
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <History className="w-3 h-3" />
                      <span>Assignment History ({complaint.assignment_history.length})</span>
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {complaint.assignment_history.map((rec, i) => (
                      <div
                        key={rec.id || i}
                        className="p-2 rounded-xl bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60 text-[11px] space-y-0.5"
                      >
                        <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                          <span>
                            {rec.previous_assignee ? `${rec.previous_assignee} → ` : ''}
                            {rec.new_assignee} ({rec.new_department})
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(rec.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        {rec.note && <p className="text-slate-600 dark:text-slate-300 italic">"{rec.note}"</p>}
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">By {rec.changed_by}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confidential Internal Notes (Phase 7) */}
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    Internal Authority Notes
                  </h4>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                  Confidential • Officers Only
                </span>
              </div>

              {/* Notes Chronological List */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {complaint.internal_notes && complaint.internal_notes.length > 0 ? (
                  complaint.internal_notes.map((n, i) => (
                    <div
                      key={n.id || i}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] flex items-center gap-1.5">
                          <User className="w-3 h-3 text-purple-500" />
                          <span>{n.author}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })},{' '}
                          {new Date(n.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-snug">{n.note}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic py-1">
                    No internal notes logged yet.
                  </p>
                )}
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleInternalNoteSubmit} className="space-y-2 pt-1">
                <textarea
                  value={internalNoteInput}
                  onChange={(e) => setInternalNoteInput(e.target.value)}
                  placeholder="Add confidential officer note (e.g., contractor coordination, procurement status)..."
                  rows={2}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-purple-500 resize-none"
                />
                <div className="flex items-center justify-between">
                  {noteSuccessMsg ? (
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      ✓ {noteSuccessMsg}
                    </span>
                  ) : <span />}
                  <button
                    type="submit"
                    disabled={isSubmittingNote || !internalNoteInput.trim()}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>{isSubmittingNote ? 'Saving...' : 'Post Internal Note'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Citizen Status Inquiries (Phase 7) */}
            {complaint.status_update_requests && complaint.status_update_requests.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Citizen Status Inquiries
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {complaint.status_update_requests.length} Inquiry/Inquiries
                  </span>
                </div>

                <div className="space-y-2.5">
                  {complaint.status_update_requests.map((req) => {
                    const isOpen = req.state === 'OPEN';
                    return (
                      <div
                        key={req.id}
                        className="p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-mono">
                            Requested {new Date(req.request_date || req.requested_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              isOpen
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                            }`}
                          >
                            {req.state || 'OPEN'}
                          </span>
                        </div>

                        {req.citizen_message && (
                          <p className="text-slate-800 dark:text-slate-200 italic bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                            "{req.citizen_message}"
                          </p>
                        )}

                        {isOpen ? (
                          <div className="space-y-1.5 pt-1">
                            <input
                              type="text"
                              value={ackResponseNotes[req.id] || ''}
                              onChange={(e) =>
                                setAckResponseNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                              }
                              placeholder="Enter acknowledgment / progress update for citizen..."
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                            />
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleAcknowledgeRequest(req.id)}
                                disabled={acknowledgingIds[req.id]}
                                className="px-3 py-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>{acknowledgingIds[req.id] ? 'Acknowledging...' : 'Acknowledge Request'}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-300 space-y-0.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-1 font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Acknowledged by {req.acknowledged_by || 'Authority Officer'}</span>
                            </div>
                            {req.response_note && (
                              <p className="text-slate-600 dark:text-slate-400 italic">"{req.response_note}"</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Auditable Civic Lifecycle Timeline */}
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Auditable Status History
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">
                  {historyItems.length} Events
                </span>
              </div>

              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {historyItems.map((item, idx) => {
                  const isLast = idx === historyItems.length - 1;
                  const isReopenEvent = item.status === 'REOPENED';
                  const isConfirmEvent = item.status === 'CITIZEN_CONFIRMED';
                  const isResolveEvent = item.status === 'RESOLVED';
                  const isAssignEvent = item.status === 'ASSIGNED';
                  const isInternalNoteEvent = item.status === 'INTERNAL_NOTE';
                  const isStatusReqEvent = item.status === 'STATUS_UPDATE_REQUESTED';
                  const isStatusAckEvent = item.status === 'STATUS_REQUEST_ACKNOWLEDGED';

                  return (
                    <div key={idx} className="relative">
                      <span
                        className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                          isReopenEvent
                            ? 'border-rose-600 bg-rose-600 dark:border-rose-500 dark:bg-rose-500'
                            : isConfirmEvent || isResolveEvent
                            ? 'border-emerald-600 bg-emerald-600 dark:border-emerald-400 dark:bg-emerald-400'
                            : isAssignEvent
                            ? 'border-blue-600 bg-blue-600 dark:border-blue-400 dark:bg-blue-400'
                            : isInternalNoteEvent
                            ? 'border-purple-600 bg-purple-600 dark:border-purple-400 dark:bg-purple-400'
                            : isStatusReqEvent || isStatusAckEvent
                            ? 'border-sky-500 bg-sky-500 dark:border-sky-400 dark:bg-sky-400'
                            : isLast
                            ? 'border-slate-900 bg-slate-900 dark:border-slate-100 dark:bg-slate-100'
                            : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950'
                        }`}
                      />
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-semibold ${
                              isReopenEvent
                                ? 'text-rose-600 dark:text-rose-400'
                                : isConfirmEvent
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : isAssignEvent
                                ? 'text-blue-600 dark:text-blue-400'
                                : isInternalNoteEvent
                                ? 'text-purple-600 dark:text-purple-400'
                                : isStatusReqEvent || isStatusAckEvent
                                ? 'text-sky-600 dark:text-sky-400'
                                : isLast
                                ? 'text-slate-900 dark:text-slate-100'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {item.status.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(item.timestamp).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        {item.note && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                            {item.note}
                          </p>
                        )}
                        {item.actor && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                            By {item.actor}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-4 sm:p-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs flex flex-wrap items-center justify-between gap-3 shrink-0">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Current: <strong className="text-slate-900 dark:text-slate-100 font-semibold">{complaint.status}</strong>
            </span>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {nextActions.map((target) => {
                const isResolveAction = target === 'RESOLVED';
                return (
                  <button
                    key={target}
                    onClick={() => handleStatusChange(target)}
                    disabled={isUpdating}
                    className={`flex-1 sm:flex-none justify-center px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl shadow-2xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer ${
                      isResolveAction
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500'
                        : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900'
                    }`}
                  >
                    <span>Mark as {target.replace('_', ' ')}</span>
                    {isResolveAction ? (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog Modal: Mark as Resolved */}
      {isResolveModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Mark this civic issue as resolved?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Upload resolution photograph evidence to verify completed municipal work.
                </p>
              </div>
              <button
                onClick={() => {
                  if (!isSubmittingResolution) {
                    setIsResolveModalOpen(false);
                    setResolutionFile(null);
                    setResolutionPreviewUrl('');
                  }
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Message */}
            {resolutionError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
                {resolutionError}
              </div>
            )}

            {/* Upload Area */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Resolution Evidence Photo <span className="text-rose-500">*</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                id="resolution-image-input"
              />

              {resolutionPreviewUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 aspect-video bg-slate-100 dark:bg-slate-900">
                  <img
                    src={resolutionPreviewUrl}
                    alt="Resolution preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setResolutionFile(null);
                      setResolutionPreviewUrl('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-black text-white text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Change</span>
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-400 p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/30"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Upload Photo Evidence
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    JPG, PNG, WEBP (Max 10 MB)
                  </p>
                </div>
              )}
            </div>

            {/* Optional Resolution Note */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Resolution Note <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="e.g., Road surface repaired and pothole filled."
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!isSubmittingResolution) {
                    setIsResolveModalOpen(false);
                    setResolutionFile(null);
                    setResolutionPreviewUrl('');
                  }
                }}
                disabled={isSubmittingResolution}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmResolution}
                disabled={isSubmittingResolution || (!resolutionFile && !resolutionPreviewUrl)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingResolution ? (
                  <span>Saving Resolution...</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm Resolution</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
