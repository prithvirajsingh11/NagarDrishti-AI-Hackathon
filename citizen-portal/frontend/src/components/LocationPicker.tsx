import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, MapPin } from 'lucide-react';
import L from 'leaflet';
import { useLanguage } from '../context/LanguageContext';

export const DEFAULT_MAP_CENTER: [number, number] = [23.2599, 77.4126];
export const DEFAULT_MAP_ZOOM = 12;

interface LocationPickerProps {
  latitude?: number;
  longitude?: number;
  locationName: string;
  onChange: (lat: number, lng: number, name: string) => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  latitude = DEFAULT_MAP_CENTER[0],
  longitude = DEFAULT_MAP_CENTER[1],
  locationName,
  onChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false, // Prevent page scroll interception on touch/scroll
      }).setView([latitude, longitude], DEFAULT_MAP_ZOOM);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Custom pulse icon for location
      const pinIcon = L.divIcon({
        className: 'custom-pin-icon',
        html: `<div style="background-color: #0284c7; width: 26px; height: 26px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center;"><div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const marker = L.marker([latitude, longitude], {
        draggable: true,
        icon: pinIcon,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChange(
          parseFloat(pos.lat.toFixed(6)),
          parseFloat(pos.lng.toFixed(6)),
          `Adjusted Location (${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})`
        );
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        onChange(
          parseFloat(e.latlng.lat.toFixed(6)),
          parseFloat(e.latlng.lng.toFixed(6)),
          `Pinned Location (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`
        );
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    } else {
      mapInstanceRef.current.setView([latitude, longitude], 15);
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      }
    }

    return () => {
      // Clean up map instance on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update view when coordinates change from outside
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapInstanceRef.current.panTo([latitude, longitude]);
    }
  }, [latitude, longitude]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy);
        setGpsLoading(false);
        onChange(
          lat,
          lng,
          `Citizen GPS Location (±${accuracy}m accuracy)`
        );
      },
      () => {
        setGpsLoading(false);
        setGpsError('Location access is unavailable. Adjust the location on the map.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const { t } = useLanguage();

  return (
    <div className="space-y-3 font-sans select-none">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <MapPin size={14} className="text-[#0B2545] dark:text-blue-400" />
          <span>{t('location.picker_title', 'Civic Location')}</span>
        </label>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={gpsLoading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/80 dark:border-blue-800/80 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-60 cursor-pointer shadow-2xs"
        >
          <Crosshair size={13} className={gpsLoading ? 'animate-spin' : ''} />
          <span>{gpsLoading ? t('location.locating', 'Locating...') : t('location.use_my_location', 'Use My GPS')}</span>
        </button>
      </div>

      {gpsError && (
        <div className="p-2.5 text-xs bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-xl">
          {gpsError}
        </div>
      )}

      {/* Prominent Selected Location Banner */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-2.5 shadow-2xs">
        <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-[#0B2545] dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
          <MapPin size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider block">
            Selected Location
          </span>
          <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
            {locationName || 'Pin selected on map'}
          </span>
          <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono block mt-0.5">
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </span>
        </div>
      </div>

      {/* Leaflet Map with Comfortable Mobile Height & Move Pin Guidance */}
      <div className="h-60 sm:h-72 w-full rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-700/90 relative shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full" />
        <div className="absolute bottom-2.5 left-2.5 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-[10.5px] font-medium text-slate-700 dark:text-slate-300 px-3 py-1 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
          <span>📍</span>
          <span>{t('location.drag_hint', 'Move Pin: Drag marker or tap map')}</span>
        </div>
      </div>

      {/* Location label input */}
      <div className="pt-1">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          {t('location.desc_label', 'Landmark / Street Description')}
        </label>
        <input
          type="text"
          value={locationName}
          onChange={(e) => onChange(latitude, longitude, e.target.value)}
          placeholder="e.g. Near MP Nagar Zone 1, Opposite City Bank"
          className="w-full px-3.5 py-2.5 text-xs sm:text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />
      </div>
    </div>
  );
};
