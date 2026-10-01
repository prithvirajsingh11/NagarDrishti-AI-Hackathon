import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Filter, Loader2, RefreshCw, ShieldCheck, MapPin, Crosshair, RotateCcw } from 'lucide-react';
import type { NearbyCivicIssue, ProblemType } from '../types/complaint';
import { getNearbyCivicIssues } from '../services/api';
import { getProblemLabel } from '../components/ProblemIcon';
import { useLanguage } from '../context/LanguageContext';

const DEFAULT_CENTER: [number, number] = [23.2599, 77.4126]; // Bhopal center

const createPinIcon = (color: string) =>
  L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="background-color: ${color}; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; cursor: pointer;"><div style="width: 6px; height: 6px; background: white; border-radius: 50%;"></div></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

export const CivicMap: React.FC<{ onReportNew?: () => void }> = ({ onReportNew }) => {
  const { t } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());

  const [issues, setIssues] = useState<NearbyCivicIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [gpsLocating, setGpsLocating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);

  const fetchIssues = useCallback(() => {
    setLoading(true);
    getNearbyCivicIssues({
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
    })
      .then((data) => setIssues(data))
      .catch((err) => console.error('Failed to load civic issues for map', err))
      .finally(() => setLoading(false));
  }, [selectedCategory, selectedStatus]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView(DEFAULT_CENTER, 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers based on data
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    markersMapRef.current.clear();

    issues.forEach((item) => {
      const color =
        item.problem_type === 'pothole'
          ? '#DC2626'
          : item.problem_type === 'garbage'
          ? '#059669'
          : item.problem_type === 'streetlight'
          ? '#D97706'
          : item.problem_type === 'drain'
          ? '#0284C7'
          : '#475569';

      const marker = L.marker([item.latitude, item.longitude], {
        icon: createPinIcon(color),
      });

      const statusBadgeBg =
        item.status === 'RESOLVED'
          ? '#D1FAE5; color: #065F46;'
          : item.status === 'IN_PROGRESS'
          ? '#DBEAFE; color: #1E40AF;'
          : item.status === 'REOPENED'
          ? '#FEF3C7; color: #92400E;'
          : '#F1F5F9; color: #334155;';

      const dateStr = item.created_at
        ? new Date(item.created_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '';

      const popupHtml = `
        <div style="font-family: 'Inter', sans-serif; font-size: 12px; min-width: 190px; line-height: 1.4; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; gap: 8px;">
            <span style="font-family: monospace; font-size: 11px; font-weight: 700; color: #0284C7;">${item.report_id}</span>
            <span style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 9999px; background: ${statusBadgeBg}">${item.status.replace('_', ' ')}</span>
          </div>
          <div style="font-weight: 700; color: #0F172A; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; margin-bottom: 6px;">
            ${getProblemLabel(item.problem_type as ProblemType, t)}
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">
            <span>📍</span> <span>${item.location_name || 'Bhopal'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94A3B8; margin-top: 4px; border-top: 1px dashed #E2E8F0; padding-top: 4px;">
            <span>Severity: <strong style="color: #475569;">${item.severity}</strong></span>
            <span>${dateStr}</span>
          </div>
          <div style="font-size: 9.5px; color: #10B981; margin-top: 4px;">
            🛡️ Privacy Protected (Approx. Coords)
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        setActiveIssueId(item.id || item.report_id);
      });

      markersLayerRef.current?.addLayer(marker);
      markersMapRef.current.set(item.id || item.report_id, marker);
    });
  }, [issues, t]);

  // Pan to user's real GPS position
  const handleLocateMe = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    setGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocating(false);
        const { latitude, longitude } = pos.coords;
        mapInstanceRef.current?.flyTo([latitude, longitude], 15, { duration: 1.5 });
      },
      () => {
        setGpsLocating(false);
      },
      { timeout: 8000 }
    );
  };

  // Reset to default city view
  const handleResetView = () => {
    mapInstanceRef.current?.flyTo(DEFAULT_CENTER, 13, { duration: 1.2 });
  };

  // Focus specific incident pin from the carousel
  const handleFocusIssue = (item: NearbyCivicIssue) => {
    const key = item.id || item.report_id;
    setActiveIssueId(key);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([item.latitude, item.longitude], 16, { duration: 1 });
      const marker = markersMapRef.current.get(key);
      if (marker) {
        marker.openPopup();
      }
    }
  };

  return (
    <div className="space-y-4 font-sans select-none max-w-5xl mx-auto px-3 sm:px-4 pb-4 lg:pb-6 animate-fade-slide-up">
      {/* Map Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t('map.title')}
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck size={12} />
              {t('map.privacy_safe')}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('map.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchIssues}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Refresh map data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* New Report Button */}
          {onReportNew && (
            <button
              type="button"
              onClick={onReportNew}
              className="px-3.5 py-1.5 bg-[#0B2545] dark:bg-blue-600 hover:bg-[#07192f] dark:hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              + {t('nav.report_issue')}
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips Bar - Mobile Horizontally Scrollable */}
      <div className="space-y-2">
        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1 shrink-0">
            <Filter size={12} />
            {t('map.category')}
          </span>
          {[
            { id: 'all', label: t('map.all_categories') },
            { id: 'pothole', label: t('problems.pothole') },
            { id: 'garbage', label: t('problems.garbage') },
            { id: 'streetlight', label: t('problems.streetlight') },
            { id: 'drain', label: t('problems.drain') },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 min-h-[34px] rounded-xl text-xs font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-[#0B2545] dark:bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 shrink-0">{t('map.status')}</span>
          {[
            { id: 'ALL', label: t('myreports.status_all') },
            { id: 'REPORTED', label: t('myreports.status_reported') },
            { id: 'IN_PROGRESS', label: t('myreports.status_in_progress') },
            { id: 'RESOLVED', label: t('myreports.status_resolved') },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setSelectedStatus(st.id)}
              className={`px-2.5 py-1.5 min-h-[32px] rounded-xl text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                selectedStatus === st.id
                  ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-semibold shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leaflet Map Card with Interactive Floating Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs h-[52vh] min-h-[340px] sm:h-[500px] relative transition-colors">
        {loading && issues.length === 0 ? (
          <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 flex items-center justify-center z-20">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-[#0B2545] dark:text-blue-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('map.loading')}</span>
            </div>
          </div>
        ) : null}

        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Floating Quick Action Map Controls (Top Right) */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 shadow-xs rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1">
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={gpsLocating}
            className="p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 transition-colors cursor-pointer"
            title="Center on my location"
            aria-label="Center on my location"
          >
            <Crosshair size={16} className={gpsLocating ? 'animate-spin text-blue-600' : ''} />
          </button>
          <button
            type="button"
            onClick={handleResetView}
            className="p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 transition-colors cursor-pointer"
            title="Reset city center"
            aria-label="Reset view to city center"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Floating Incident Count Badge (Bottom Left) */}
        <div className="absolute bottom-3 left-3 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl shadow-xs text-[11px] sm:text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 sm:gap-2">
          <MapPin size={12} className="text-[#0B2545] dark:text-blue-400 shrink-0" />
          <span>{issues.length} {issues.length === 1 ? t('map.incident_plotted') : t('map.incidents_plotted')}</span>
        </div>
      </div>

      {/* Interactive Incident Carousel / Quick Jump Bar */}
      {issues.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Explore Mapped Incidents ({issues.length})
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
            {issues.slice(0, 8).map((issue) => {
              const isSelected = activeIssueId === (issue.id || issue.report_id);

              return (
                <button
                  key={issue.id || issue.report_id}
                  type="button"
                  onClick={() => handleFocusIssue(issue)}
                  className={`min-w-[180px] p-2.5 rounded-xl border text-left transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 shadow-xs'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{issue.report_id}</span>
                    <span className="text-slate-400">{issue.status}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {getProblemLabel(issue.problem_type as ProblemType, t)}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    📍 {issue.location_name || 'Bhopal'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
