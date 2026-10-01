import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Shield,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type {
  Complaint,
  ComplaintStatus,
  ComplaintStatusHistoryItem,
  DashboardStatistics,
  HeatmapPoint,
} from '../types/complaint';
import {
  getComplaints,
  getComplaintHistory,
  getControlledImageUrl,
  getDashboardHeatmap,
  getDashboardStatistics,
  updateComplaintStatus,
  uploadComplaintImage,
} from '../services/api';
import { ProblemIcon, getProblemLabel } from '../components/ProblemIcon';
import { SeverityBadge } from '../components/SeverityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { optimizeImageForUpload } from '../utils/imageOptimizer';

const DEFAULT_CENTER: [number, number] = [23.2599, 77.4126];

export const AuthorityDashboard: React.FC = () => {
  const { t } = useLanguage();
  const { token } = useAuth();

  // State
  const [stats, setStats] = useState<DashboardStatistics | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [heatmapPoints, setHeatmapPoints] = useState<HeatmapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'queue' | 'map' | 'operations'>('queue');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected complaint for bottom sheet / modal operations
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [auditHistory, setAuditHistory] = useState<ComplaintStatusHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Operational Action State
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<ComplaintStatus>('IN_PROGRESS');
  const [resolutionPhotoFile, setResolutionPhotoFile] = useState<File | null>(null);
  const [resolutionPreview, setResolutionPreview] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Leaflet Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.LayerGroup | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const resolutionInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial authority dashboard data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, complaintsData, heatData] = await Promise.allSettled([
        getDashboardStatistics(),
        getComplaints({ limit: 100 }),
        getDashboardHeatmap(),
      ]);

      if (statsData.status === 'fulfilled') setStats(statsData.value);
      if (complaintsData.status === 'fulfilled') setComplaints(complaintsData.value);
      if (heatData.status === 'fulfilled') setHeatmapPoints(heatData.value);
    } catch (err) {
      console.warn('Authority data load issue:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load audit history when a complaint is inspected
  useEffect(() => {
    if (!selectedComplaint) {
      setAuditHistory([]);
      return;
    }
    setNewStatus(selectedComplaint.status);
    setResolutionPhotoFile(null);
    setResolutionPreview(null);
    setActionSuccess(null);
    setActionError(null);

    setLoadingHistory(true);
    getComplaintHistory(selectedComplaint.id || selectedComplaint.report_id)
      .then((hist) => setAuditHistory(hist))
      .catch(() => setAuditHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [selectedComplaint]);

  // Initialize Map for Authority
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView(DEFAULT_CENTER, 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      // Add touch-friendly zoom controls on top right
      L.control.zoom({ position: 'topright' }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      heatLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Map Markers & Heatmap representation
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    complaints.forEach((c) => {
      if (!c.latitude || !c.longitude) return;

      const isCritical = c.severity === 'CRITICAL' || c.severity === 'HIGH';
      const color =
        c.status === 'RESOLVED'
          ? '#10B981'
          : isCritical
          ? '#EF4444'
          : '#3B82F6';

      const icon = L.divIcon({
        className: 'authority-marker',
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; cursor: pointer;"><div style="width: 7px; height: 7px; background: white; border-radius: 50%;"></div></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([c.latitude, c.longitude], { icon });
      marker.on('click', () => {
        setSelectedComplaint(c);
        setDetailOpen(true);
      });
      markersLayerRef.current?.addLayer(marker);
    });
  }, [complaints]);

  // Update Heatmap circles layer
  useEffect(() => {
    if (!mapInstanceRef.current || !heatLayerRef.current) return;
    heatLayerRef.current.clearLayers();

    if (showHeatmap && heatmapPoints.length > 0) {
      heatmapPoints.forEach((pt) => {
        const radius = Math.max(120, (pt.weight || 1) * 60);
        const circle = L.circle([pt.latitude, pt.longitude], {
          radius,
          color: '#EF4444',
          fillColor: '#EF4444',
          fillOpacity: 0.35,
          weight: 1,
        });
        circle.bindTooltip(`Density: ${pt.problem_type} (${pt.severity})`);
        heatLayerRef.current?.addLayer(circle);
      });
    }
  }, [showHeatmap, heatmapPoints]);

  // Handle Resolution Photo Selection
  const handleResolutionPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const raw = e.target.files[0];
      try {
        const optimized = await optimizeImageForUpload(raw);
        setResolutionPhotoFile(optimized);
        setResolutionPreview(URL.createObjectURL(optimized));
      } catch {
        setResolutionPhotoFile(raw);
        setResolutionPreview(URL.createObjectURL(raw));
      }
    }
  };

  // Submit Status Update / Resolution Action
  const handleExecuteStatusUpdate = async () => {
    if (!selectedComplaint) return;
    setUpdatingStatus(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      let resolutionUrl: string | null = null;
      if (resolutionPhotoFile) {
        resolutionUrl = await uploadComplaintImage(resolutionPhotoFile);
      }

      const updated = await updateComplaintStatus(
        selectedComplaint.id || selectedComplaint.report_id,
        newStatus,
        resolutionUrl
      );

      setSelectedComplaint(updated);
      setComplaints((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setActionSuccess(`Status updated to ${newStatus} successfully.`);
      // Refresh audit history
      getComplaintHistory(updated.id || updated.report_id).then(setAuditHistory);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update complaint status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Filter complaints
  const filteredComplaints = complaints.filter((c) => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (severityFilter !== 'ALL' && c.severity !== severityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = (c.report_id || '').toLowerCase().includes(q);
      const matchLoc = (c.location_name || '').toLowerCase().includes(q);
      const matchDept = (c.department || '').toLowerCase().includes(q);
      const matchType = (c.problem_type || '').toLowerCase().includes(q);
      if (!matchId && !matchLoc && !matchDept && !matchType) return false;
    }
    return true;
  });

  // Calculate Operational Metrics
  const totalReports = stats?.total_reports ?? complaints.length;
  const highPriorityCount = complaints.filter(
    (c) => (c.severity === 'HIGH' || c.severity === 'CRITICAL') && c.status !== 'RESOLVED'
  ).length;
  const pendingCount = complaints.filter((c) => c.status === 'REPORTED').length;
  const inProgressCount = complaints.filter((c) => c.status === 'IN_PROGRESS' || c.status === 'ASSIGNED').length;
  const resolvedCount = complaints.filter((c) => c.status === 'RESOLVED').length;

  return (
    <div className="w-full space-y-4 font-sans select-none pb-4 lg:pb-6 animate-fade-slide-up">
      {/* 1. Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              <Shield size={18} />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Authority Command Center ({totalReports})
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Operational triage, AI GIS cluster distribution, and field verification gate.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
            title="Refresh operational data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden xs:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Operational KPI Summary Cards (Mobile 2x2 Grid, Desktop 4 Cols) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* High Priority */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">High Priority</span>
            <AlertTriangle size={15} />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {highPriorityCount}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            Requires immediate dispatch
          </span>
        </div>

        {/* Pending */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Pending Triage</span>
            <Clock size={15} />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {pendingCount}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            Awaiting field assignment
          </span>
        </div>

        {/* In Progress */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">In Progress</span>
            <SlidersHorizontal size={15} />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {inProgressCount}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            Field crews deployed
          </span>
        </div>

        {/* Resolved */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-xs transition-colors">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Resolved</span>
            <CheckCircle2 size={15} />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {resolvedCount}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            Citizen verification gate open
          </span>
        </div>
      </div>

      {/* 3. Section Switcher Tabs on Mobile */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('queue')}
          className={`flex-1 py-2 rounded-lg transition-all text-center cursor-pointer ${
            activeTab === 'queue'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Priority Queue ({filteredComplaints.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-2 rounded-lg transition-all text-center cursor-pointer ${
            activeTab === 'map'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          GIS Operational Map
        </button>
      </div>

      {/* 4. Queue Filters & Search */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search report ID, location, or department..."
            className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-blue-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Status:
          </span>
          {['ALL', 'REPORTED', 'IN_PROGRESS', 'RESOLVED', 'REOPENED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap cursor-pointer transition-colors ${
                statusFilter === st
                  ? 'bg-[#0B2545] dark:bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Severity Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Severity:
          </span>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setSeverityFilter(sev)}
              className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap cursor-pointer transition-colors ${
                severityFilter === sev
                  ? 'bg-rose-600 text-white font-semibold shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* 5. CONTENT: Queue View or Map View */}
      {activeTab === 'map' ? (
        /* Authority Leaflet GIS Map */
        <div className="space-y-2.5">
          <div className="h-[55vh] min-h-[360px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 relative shadow-inner">
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Top Right Floating Heatmap Toggle */}
            <div className="absolute top-3 right-14 z-20">
              <button
                type="button"
                onClick={() => setShowHeatmap((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer ${
                  showHeatmap
                    ? 'bg-rose-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                }`}
                title="Toggle density heatmap layer"
              >
                <Flame size={13} className={showHeatmap ? 'text-amber-300' : 'text-rose-500'} />
                <span>{showHeatmap ? 'Heatmap ON' : 'Heatmap'}</span>
              </button>
            </div>
            
            {/* Top Left Floating Legend */}
            <div className="absolute top-3 left-3 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-[10.5px] space-y-1 shadow-xs">
              <div className="font-bold text-slate-800 dark:text-slate-200">Incident Severity</div>
              <div className="flex items-center gap-1.5 text-rose-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Critical / High
              </div>
              <div className="flex items-center gap-1.5 text-blue-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Medium / Low
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Resolved
              </div>
            </div>

            {/* Bottom Hint */}
            <div className="absolute bottom-3 left-3 z-20 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 shadow-xs">
              Tap any pin to inspect details & assign action
            </div>
          </div>
        </div>
      ) : (
        /* Priority Complaints Queue */
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span>Priority Complaints</span>
            <span>{filteredComplaints.length} Records</span>
          </div>

          {filteredComplaints.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              No matching civic complaints found for this filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {filteredComplaints.map((c) => {
                const isUrgent = c.severity === 'CRITICAL' || c.severity === 'HIGH';
                const createdDate = c.created_at ? new Date(c.created_at).toLocaleDateString() : '';

                return (
                  <div
                    key={c.id || c.report_id}
                    onClick={() => {
                      setSelectedComplaint(c);
                      setDetailOpen(true);
                    }}
                    className={`p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-800 border transition-all cursor-pointer shadow-xs ${
                      isUrgent
                        ? 'border-l-4 border-l-rose-500 border-slate-200 dark:border-slate-700'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {/* Header: ID, Severity, Status */}
                    <div className="flex items-start justify-between gap-1.5 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded">
                          {c.report_id}
                        </span>
                        <SeverityBadge severity={c.severity} size="sm" />
                      </div>
                      <StatusBadge status={c.status} />
                    </div>

                    {/* Problem Name & Icon */}
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white mb-1.5">
                      <ProblemIcon type={c.problem_type} size={15} />
                      <span className="capitalize">{getProblemLabel(c.problem_type, t)}</span>
                    </div>

                    {/* Location & Date */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                      <div className="flex items-center gap-1 truncate max-w-[65%]">
                        <MapPin size={12} className="shrink-0 text-slate-400" />
                        <span className="truncate">{c.location_name || 'Bhopal'}</span>
                      </div>
                      {createdDate && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                          <Clock size={11} />
                          <span>{createdDate}</span>
                        </div>
                      )}
                    </div>

                    {/* Department & Age Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/80 text-[10.5px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                        {c.department}
                      </span>
                      <span className="text-blue-600 dark:text-blue-400 font-semibold inline-flex items-center gap-1">
                        <span>Manage</span>
                        <ArrowRight size={11} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. Mobile Operational Bottom Sheet / Drawer */}
      {detailOpen && selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                  {selectedComplaint.report_id}
                </span>
                <StatusBadge status={selectedComplaint.status} />
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Action feedback banner */}
              {actionSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{actionSuccess}</span>
                </div>
              )}
              {actionError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Photos: Citizen Evidence & Resolution Evidence */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Incident Photography
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10.5px] text-slate-500 block mb-1">Citizen Photo:</span>
                    <div className="h-32 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <img
                        src={getControlledImageUrl(selectedComplaint.image_url, token)}
                        alt="Citizen Upload"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10.5px] text-slate-500 block mb-1">Resolution Work Photo:</span>
                    {resolutionPreview || selectedComplaint.resolution_image_url ? (
                      <div className="h-32 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-emerald-300 dark:border-emerald-800">
                        <img
                          src={resolutionPreview || getControlledImageUrl(selectedComplaint.resolution_image_url, token)}
                          alt="Resolution"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        onClick={() => resolutionInputRef.current?.click()}
                        className="h-32 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                      >
                        <Camera size={20} />
                        <span className="text-[10px] font-semibold">Upload Evidence</span>
                      </div>
                    )}
                  </div>
                </div>

                <input
                  ref={resolutionInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={handleResolutionPhoto}
                  className="hidden"
                />
              </div>

              {/* Status Update Form */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <span className="text-[10.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                  Update Operational Status
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as ComplaintStatus)}
                    className="p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100"
                  >
                    <option value="REPORTED">REPORTED</option>
                    <option value="ASSIGNED">ASSIGNED</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="REOPENED">REOPENED</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleExecuteStatusUpdate}
                    disabled={updatingStatus}
                    className="py-2.5 px-3 bg-[#0B2545] hover:bg-[#07192f] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {updatingStatus ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Commit Status</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Incident Details Summary */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-[11px]">
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px]">Category:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">{selectedComplaint.problem_type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px]">Assigned Dept:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedComplaint.department}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-400 block font-semibold text-[10px]">Location:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{selectedComplaint.location_name}</span>
                </div>
              </div>

              {/* Audit Trail Timeline */}
              <div className="space-y-2">
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">
                  Audit History Timeline
                </span>
                {loadingHistory ? (
                  <div className="text-slate-400 text-center py-2">Loading audit trail...</div>
                ) : auditHistory.length === 0 ? (
                  <div className="text-slate-400 text-center py-2">Initial registration record.</div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {auditHistory.map((item, i) => (
                      <div
                        key={item.id || i}
                        className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-[11px]"
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-slate-800 dark:text-slate-200">
                            {item.new_status}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.created_at ? new Date(item.created_at).toLocaleTimeString() : ''}
                          </span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">
                          Changed by: {item.changed_by_role}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Bottom Safe Action */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0 flex items-center justify-end safe-bottom">
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
