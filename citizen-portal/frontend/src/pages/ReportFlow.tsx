import React, { useRef, useState } from 'react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Edit2,
  Image as ImageIcon,
  LayoutGrid,
  Lightbulb,
  Loader2,
  MapPin,
  Map as MapIcon,
  MoreHorizontal,
  Trash2,
  Droplets,
  User,
  Lock,
} from 'lucide-react';
import type {
  CivicDetectionResult,
  Complaint,
  ProblemType,
  SeverityLevel,
} from '../types/complaint';
import {
  analyzeCivicImage,
  createComplaint,
  uploadComplaintImage,
} from '../services/api';
import { ProblemIcon, getProblemLabel } from '../components/ProblemIcon';
import { SeverityBadge } from '../components/SeverityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { LocationPicker, DEFAULT_MAP_CENTER } from '../components/LocationPicker';
import { RoadIcon, IndianFlagGraphic } from '../components/CivicEmblems';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { optimizeImageForUpload } from '../utils/imageOptimizer';

interface ReportFlowProps {
  onCancel: () => void;
  onSuccess: (complaint: Complaint) => void;
  onRequireAuth?: () => void;
}

type Step =
  | 'capture'
  | 'analyzing'
  | 'review_ai'
  | 'edit_ai'
  | 'location'
  | 'confirm'
  | 'submitting'
  | 'success';

export const ReportFlow: React.FC<ReportFlowProps> = ({
  onCancel,
  onSuccess,
  onRequireAuth,
}) => {
  const { t } = useLanguage();
  const { citizen, isLoggedIn, loading } = useAuth();

  const [currentStep, setCurrentStep] = useState<Step>('capture');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzingError, setAnalyzingError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [showMapPicker, setShowMapPicker] = useState<boolean>(false);

  // Hidden file inputs for Camera and Gallery
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // AI Detection State
  const [aiResult, setAiResult] = useState<CivicDetectionResult | null>(null);

  // Editable fields
  const [editedProblemType, setEditedProblemType] = useState<ProblemType>('pothole');
  const [editedSeverity, setEditedSeverity] = useState<SeverityLevel>('HIGH');
  const [description, setDescription] = useState<string>('');

  // Location State
  const [latitude, setLatitude] = useState<number>(DEFAULT_MAP_CENTER[0]);
  const [longitude, setLongitude] = useState<number>(DEFAULT_MAP_CENTER[1]);
  const [locationName, setLocationName] = useState<string>('Bhopal, Madhya Pradesh');

  // Submission state
  const [submittedComplaint, setSubmittedComplaint] = useState<Complaint | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-detect geolocation if possible
  const handleAutoDetectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          setLocationName(
            `Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)}`
          );
        },
        (error) => {
          console.warn('Geolocation unavailable:', error.message);
        },
        { timeout: 8000 }
      );
    }
  };

  // Prevent flash while auth session is restoring
  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-800 dark:text-slate-200 mx-auto mb-3" />
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Verifying citizen session...
        </p>
      </div>
    );
  }

  // If user is genuinely not logged in, enforce sign-in gate before reporting
  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6 sm:p-8 text-center space-y-5 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-[#0B2545] dark:bg-blue-600 text-white flex items-center justify-center mx-auto shadow-xs">
            <Lock size={22} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-sans">
              {t('auth.report_gate_title', 'Citizen Sign In Required')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto font-sans">
              {t('auth.report_gate_desc', 'Please sign in or create a citizen account before reporting a civic issue.')}
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={onRequireAuth || onCancel}
              className="w-full py-2.5 px-4 bg-[#0B2545] hover:bg-[#07192f] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs font-sans"
            >
              <User size={14} />
              <span>{t('auth.login', 'Sign In / Register to Report')}</span>
            </button>
            <button
              onClick={onCancel}
              className="w-full py-2 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs rounded-xl transition-colors cursor-pointer font-sans"
            >
              {t('report.back', 'Back to Home')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Process image with client-side optimization and validation
  const processSelectedFile = async (rawFile: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(rawFile.type.toLowerCase()) || rawFile.size > 10 * 1024 * 1024) {
      setAnalyzingError('Please upload a valid image (JPG, PNG, WEBP - Max 10MB).');
      return;
    }
    try {
      const optimized = await optimizeImageForUpload(rawFile);
      setSelectedFile(optimized);
      setPreviewUrl(URL.createObjectURL(optimized));
      setAnalyzingError(null);
    } catch {
      // Fallback to original file if client optimization encounters an issue
      setSelectedFile(rawFile);
      setPreviewUrl(URL.createObjectURL(rawFile));
      setAnalyzingError(null);
    }
  };

  // Handle local file selection from input
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processSelectedFile(e.target.files[0]);
    }
  };

  // Direct camera capture: on Android native app opens hardware camera directly, on website triggers input
  const handleTakePhoto = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const photo = await CapCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
        });

        if (photo.webPath) {
          const response = await fetch(photo.webPath);
          const blob = await response.blob();
          const ext = photo.format || 'jpg';
          const file = new File([blob], `civic-camera-${Date.now()}.${ext}`, {
            type: blob.type || `image/${ext}`,
          });
          await processSelectedFile(file);
          return;
        }
      } catch (err: any) {
        if (err?.message?.includes('User cancelled') || err?.message?.includes('cancelled')) {
          return;
        }
        console.warn('Native camera capture failed, falling back to input:', err);
      }
    }

    cameraInputRef.current?.click();
  };

  // Gallery picker: on Android native app opens photo library directly, on website triggers input
  const handleOpenGallery = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const photo = await CapCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Photos,
        });

        if (photo.webPath) {
          const response = await fetch(photo.webPath);
          const blob = await response.blob();
          const ext = photo.format || 'jpg';
          const file = new File([blob], `civic-gallery-${Date.now()}.${ext}`, {
            type: blob.type || `image/${ext}`,
          });
          await processSelectedFile(file);
          return;
        }
      } catch (err: any) {
        if (err?.message?.includes('User cancelled') || err?.message?.includes('cancelled')) {
          return;
        }
        console.warn('Native gallery picker failed, falling back to input:', err);
      }
    }

    galleryInputRef.current?.click();
  };

  // Trigger AI Analysis
  const handleStartAnalysis = async () => {
    if (!selectedFile) {
      return;
    }

    setIsAnalyzing(true);
    setCurrentStep('analyzing');
    setAnalyzingError(null);

    try {
      const result = await analyzeCivicImage(selectedFile);
      setAiResult(result);
      setEditedProblemType(result.problem_type);
      setEditedSeverity(result.severity);
      setCurrentStep('review_ai');
    } catch (err: any) {
      setAnalyzingError(
        err.message || 'AI analysis is temporarily unavailable. Please try again.'
      );
      setCurrentStep('capture');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Submit final complaint with double-submission protection
  const handleSubmitComplaint = async () => {
    if (!selectedFile || !aiResult || isSubmitting) return;

    setIsSubmitting(true);
    setCurrentStep('submitting');
    try {
      // 1. Upload image to Supabase Storage
      const uploadedUrl = await uploadComplaintImage(selectedFile);

      // 2. Create complaint in Supabase DB
      const newComplaint = await createComplaint({
        problem_type: editedProblemType,
        confidence: aiResult.confidence,
        severity: editedSeverity,
        evidence: aiResult.evidence,
        latitude,
        longitude,
        location_name: locationName,
        department: aiResult.suggested_department || 'Municipal Corporation',
        description,
        image_url: uploadedUrl,
      });

      setSubmittedComplaint(newComplaint);
      setCurrentStep('success');
    } catch (err: any) {
      const errMsg = err.message || 'Failed to submit complaint. Please try again.';
      setAnalyzingError(errMsg);
      setCurrentStep('confirm');
      if (errMsg.toLowerCase().includes('session has expired') && onRequireAuth) {
        setTimeout(() => onRequireAuth(), 1200);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step indicator number
  const getStepNumber = () => {
    switch (currentStep) {
      case 'capture':
        return 1;
      case 'analyzing':
      case 'review_ai':
      case 'edit_ai':
        return 2;
      case 'location':
        return 3;
      case 'confirm':
      case 'submitting':
      case 'success':
        return 4;
      default:
        return 1;
    }
  };

  const stepNumber = getStepNumber();

  return (
    <div className="w-full font-sans select-none pb-4 lg:pb-6 animate-fade-slide-up">
      {/* Hidden file inputs for Camera vs Gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
        {/* CENTER / MAIN CONTENT (8 cols on desktop) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Top row: Back button & Step progress */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (currentStep === 'capture') onCancel();
                else if (currentStep === 'review_ai') setCurrentStep('capture');
                else if (currentStep === 'edit_ai') setCurrentStep('review_ai');
                else if (currentStep === 'location') setCurrentStep('review_ai');
                else if (currentStep === 'confirm') setCurrentStep('location');
                else onCancel();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>{t('report.back', 'Back')}</span>
            </button>

            {/* Step 1/4 + 4 Horizontal Segment Bars */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('report.step', 'Step')} {stepNumber}/4
              </span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((step) => (
                  <span
                    key={step}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      step <= stepNumber
                        ? 'w-7 bg-[#2563EB] dark:bg-blue-500'
                        : 'w-7 bg-slate-200 dark:bg-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Heading and Subheading */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t('report.header_title', 'Report Civic Issue')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-normal mt-1 leading-relaxed">
              {t('report.header_subtitle', 'Help improve your city. Report issues like potholes, garbage, broken streetlights and more.')}
            </p>
          </div>

          {analyzingError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{analyzingError}</span>
              </div>
              {selectedFile && (
                <button
                  type="button"
                  onClick={handleStartAnalysis}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] transition-colors shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* ================= STEP 1: CAPTURE / MAIN UI ================= */}
          {currentStep === 'capture' && (
            <div className="space-y-3.5">
              {/* Card 1: Upload or Snap Photo */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-8 text-center shadow-xs flex flex-col items-center justify-center transition-colors">
                {previewUrl ? (
                  <div className="w-full space-y-4">
                    {/* Large but properly constrained preview */}
                    <div className="h-56 sm:h-72 w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative shadow-inner border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                      <img
                        src={previewUrl}
                        alt="Civic Issue Preview"
                        className="h-full w-auto max-w-full object-contain mx-auto"
                      />
                    </div>

                    {/* Immediate Post-Capture Actions: Retake and Use Photo & Analyze */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full pt-1">
                      <button
                        type="button"
                        onClick={handleTakePhoto}
                        className="w-full sm:w-auto py-2.5 px-4 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                      >
                        <Camera size={14} />
                        <span>{t('report.retake', 'Retake Photo')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenGallery}
                        className="w-full sm:w-auto py-2.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ImageIcon size={14} />
                        <span>{t('report.change_gallery', 'Change Photo')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleStartAnalysis}
                        disabled={isAnalyzing}
                        className="w-full sm:flex-1 py-2.5 px-5 bg-[#0B2545] hover:bg-[#07192f] dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>{t('report.processing', 'Processing Image...')}</span>
                          </>
                        ) : (
                          <>
                            <span>Use Photo & Run AI Analysis</span>
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Center Camera Circular Badge */}
                    <div className="w-16 h-16 rounded-full bg-[#F0F5FF] dark:bg-blue-950/60 text-[#1D4ED8] dark:text-blue-400 flex items-center justify-center mb-3.5 shadow-2xs">
                      <Camera size={30} strokeWidth={2.2} />
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                      {t('report.upload_title', 'Upload or Snap Photo')}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                      {t('report.upload_desc', 'Clear photos help us understand the issue better. (JPG, PNG, WEBP – Max 10MB)')}
                    </p>

                    {/* Action Buttons: Take Photo (Primary on Mobile) & Choose from Gallery (Secondary) */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 mt-5 w-full max-w-sm">
                      <button
                        type="button"
                        onClick={handleTakePhoto}
                        className="w-full py-2.5 px-6 bg-[#0B2545] hover:bg-[#07192f] dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center justify-center gap-2.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <Camera size={16} strokeWidth={2} />
                        <span>{t('report.take_photo', 'Take Photo')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenGallery}
                        className="w-full py-2.5 px-6 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium rounded-xl flex items-center justify-center gap-2.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <ImageIcon size={16} />
                        <span>{t('report.choose_gallery', 'Choose from Gallery')}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Card 2: Location */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div
                    className="flex items-center gap-3 cursor-pointer select-none min-w-0"
                    onClick={handleAutoDetectLocation}
                    title="Click to auto-detect location"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#1D4ED8] dark:text-blue-400 flex items-center justify-center shrink-0">
                      <MapPin size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                        {t('report.location_title', 'Location')}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px] sm:max-w-md">
                        {locationName || t('report.location_autodetect', 'Auto-detect or select on map')}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowMapPicker(!showMapPicker)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                  >
                    <MapIcon size={14} className="text-slate-600 dark:text-slate-400" />
                    <span>{t('report.select_on_map', 'Select on Map >')}</span>
                  </button>
                </div>

                {/* Inline Map Picker dropdown/toggle */}
                {showMapPicker && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <LocationPicker
                      latitude={latitude}
                      longitude={longitude}
                      locationName={locationName}
                      onChange={(lat, lng, name) => {
                        setLatitude(lat);
                        setLongitude(lng);
                        setLocationName(name);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Card 3: Common Issue Types */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <LayoutGrid size={16} className="text-slate-700 dark:text-slate-300" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                    {t('report.common_issue_types', 'Common Issue Types')}
                  </span>
                </div>

                {/* Category Chips matching layout */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditedProblemType('pothole')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      editedProblemType === 'pothole'
                        ? 'border-[#2563EB] bg-[#EEF4FF] dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 font-semibold ring-1 ring-[#2563EB]/20 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <RoadIcon size={14} hasCrack className="text-current shrink-0" />
                    <span className="truncate">{t('problems.pothole', 'Pothole')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditedProblemType('garbage')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      editedProblemType === 'garbage'
                        ? 'border-[#2563EB] bg-[#EEF4FF] dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 font-semibold ring-1 ring-[#2563EB]/20 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Trash2 size={14} className="text-current shrink-0" />
                    <span className="truncate">{t('problems.garbage', 'Garbage Dump')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditedProblemType('streetlight')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      editedProblemType === 'streetlight'
                        ? 'border-[#2563EB] bg-[#EEF4FF] dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 font-semibold ring-1 ring-[#2563EB]/20 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Lightbulb size={14} className="text-current shrink-0" />
                    <span className="truncate">{t('problems.streetlight', 'Broken Streetlight')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditedProblemType('drain')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      editedProblemType === 'drain'
                        ? 'border-[#2563EB] bg-[#EEF4FF] dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 font-semibold ring-1 ring-[#2563EB]/20 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Droplets size={14} className="text-current shrink-0" />
                    <span className="truncate">{t('problems.drain', 'Blocked Drain')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditedProblemType('pothole')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      editedProblemType === 'pothole'
                        ? 'border-[#2563EB] bg-[#EEF4FF] dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 font-semibold ring-1 ring-[#2563EB]/20 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <RoadIcon size={14} className="text-current shrink-0" />
                    <span className="truncate">{t('problems.damaged_road', 'Damaged Road')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditedProblemType('other')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      editedProblemType === 'other'
                        ? 'border-[#2563EB] bg-[#EEF4FF] dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 font-semibold ring-1 ring-[#2563EB]/20 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <MoreHorizontal size={14} className="text-current shrink-0" />
                    <span className="truncate">{t('problems.other', 'Other')}</span>
                  </button>
                </div>
              </div>

              {/* Bottom Full-Width CTA: Analyze with AI */}
              <button
                type="button"
                onClick={handleStartAnalysis}
                disabled={isAnalyzing}
                className="w-full py-3 px-6 bg-[#0B2545] hover:bg-[#07192f] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer mt-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{t('report.processing', 'Processing Image...')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('report.analyze_btn', 'Analyze with AI')}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          )}

          {/* ================= STEP 2: ANALYZING ================= */}
          {currentStep === 'analyzing' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800 text-center space-y-5 shadow-xs transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#1D4ED8] dark:text-blue-400 flex items-center justify-center mx-auto shadow-xs">
                <Loader2 size={24} className="animate-spin" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Analyzing civic issue...
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  AI vision model is inspecting the uploaded evidence
                </p>
              </div>

              <div className="max-w-xs mx-auto space-y-2.5 text-xs text-left bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 font-medium">
                  <div className="w-4 h-4 rounded-full bg-[#0B2545] dark:bg-blue-600 text-white flex items-center justify-center text-[10px]">
                    ✓
                  </div>
                  <span>Scanning image features</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 font-medium">
                  <div className="w-4 h-4 rounded-full bg-[#0B2545] dark:bg-blue-600 text-white flex items-center justify-center text-[10px]">
                    ✓
                  </div>
                  <span>Estimating defect severity</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 font-medium">
                  <Loader2 size={13} className="animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-slate-900 dark:text-white font-semibold">
                    Routing to municipal department...
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 3: REVIEW AI RESULT ================= */}
          {currentStep === 'review_ai' && aiResult && (
            <div className="space-y-4">
              {/* Low Confidence Warning Guard */}
              {aiResult.confidence < 0.5 && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-4 sm:p-5 text-center space-y-3 shadow-xs">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
                      Low AI Detection Confidence
                    </h4>
                    <p className="text-xs text-amber-800 dark:text-amber-300 max-w-sm mx-auto">
                      We couldn't clearly identify the civic issue. Please capture a clearer photo.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setAiResult(null);
                        setCurrentStep('capture');
                      }}
                      className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <Camera size={14} />
                      <span>Retake Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentStep('edit_ai')}
                      className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-amber-100 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-medium text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Edit Manually
                    </button>
                  </div>
                </div>
              )}

              {/* Main AI Result Presentation Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs transition-colors">
                {/* AI Card Header */}
                <div className="bg-[#0B2545] dark:bg-slate-800 text-white p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-blue-400" />
                    <span className="font-bold text-xs tracking-tight uppercase">
                      AI Detection Result
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {aiResult.is_fallback && (
                      <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md">
                        DEMO FALLBACK
                      </span>
                    )}
                    <span className="text-[11px] font-mono bg-white/15 px-2.5 py-0.5 rounded-md text-white font-semibold">
                      {Math.round(aiResult.confidence * 100)}% Confidence
                    </span>
                  </div>
                </div>

                <div className="p-4 sm:p-5 space-y-3.5 text-xs">
                  {/* Field 1: Category */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Category
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mt-0.5 truncate">
                        <ProblemIcon type={editedProblemType} size={16} />
                        <span className="truncate">{getProblemLabel(editedProblemType, t)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep('edit_ai')}
                      className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>
                  </div>

                  {/* Field 2 & 3: Confidence & Severity in 2 columns */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Confidence */}
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Confidence
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                        {aiResult.confidence >= 0.8
                          ? 'High'
                          : aiResult.confidence >= 0.5
                          ? 'Moderate'
                          : 'Low'}{' '}
                        ({Math.round(aiResult.confidence * 100)}%)
                      </div>
                    </div>

                    {/* Severity */}
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Severity
                        </div>
                        <div className="mt-1">
                          <SeverityBadge severity={editedSeverity} size="sm" />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep('edit_ai')}
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  </div>

                  {/* Field 4: Department */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Department Assigned
                    </div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {aiResult.suggested_department || 'Municipal Corporation'}
                    </div>
                  </div>

                  {/* Evidence flags if present */}
                  {aiResult.evidence && aiResult.evidence.length > 0 && (
                    <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Visual Evidence Detected
                      </div>
                      <ul className="space-y-0.5 list-disc list-inside text-slate-600 dark:text-slate-300 text-[11.5px]">
                        {aiResult.evidence.map((ev, i) => (
                          <li key={i}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* User Understanding Prompt */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
                    <Lightbulb size={15} className="text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
                      <span className="font-bold">What did the AI detect?</span> Category: {getProblemLabel(editedProblemType, t)} ({editedSeverity} severity). Citizens have final authority to modify any field before submission.
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setCurrentStep('edit_ai')}
                  className="w-full sm:flex-1 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer text-center"
                >
                  {t('report.edit', 'Edit Detection')}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('location')}
                  className="w-full sm:flex-1 py-3 bg-[#0B2545] hover:bg-[#07192f] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>{t('report.continue', 'Confirm Location')}</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 4: EDIT RESULT OVERRIDE ================= */}
          {currentStep === 'edit_ai' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs transition-colors">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('report.edit', 'Edit AI Detection')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Citizens always have final authority to correct AI classifications before submitting.
                </p>
              </div>

              {/* Category selection */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('report.detected_problem', 'Problem Category')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['pothole', 'garbage', 'streetlight', 'drain', 'other'] as ProblemType[]).map(
                    (cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setEditedProblemType(cat)}
                        className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                          editedProblemType === cat
                            ? 'border-[#2563EB] bg-[#EEF4FF] dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 font-semibold ring-1 ring-[#2563EB]/20'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <ProblemIcon type={cat} size={15} />
                        <span>{getProblemLabel(cat, t)}</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Severity selection */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('report.visual_severity', 'Visual Severity')}
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as SeverityLevel[]).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setEditedSeverity(sev)}
                      className={`py-1.5 text-center rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                        editedSeverity === sev
                          ? 'border-[#0B2545] bg-[#0B2545] dark:bg-blue-600 dark:border-blue-600 text-white'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Additional Details (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Danger to pedestrians, water logging for 3 days..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl focus:border-slate-400 focus:outline-hidden"
                />
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setCurrentStep('review_ai')}
                  className="w-full py-2.5 bg-[#0B2545] hover:bg-[#07192f] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
                >
                  {t('report.done_editing', 'Done Editing')}
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 5: LOCATION CONFIRMATION ================= */}
          {currentStep === 'location' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
                <LocationPicker
                  latitude={latitude}
                  longitude={longitude}
                  locationName={locationName}
                  onChange={(lat, lng, name) => {
                    setLatitude(lat);
                    setLongitude(lng);
                    setLocationName(name);
                  }}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setCurrentStep('review_ai')}
                  className="w-full sm:flex-1 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer text-center"
                >
                  {t('report.back', 'Back')}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('confirm')}
                  className="w-full sm:flex-1 py-3 bg-[#0B2545] hover:bg-[#07192f] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>{t('report.review_complaint', 'Review & Submit')}</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ================= STEP 6: FINAL CONFIRMATION ================= */}
          {currentStep === 'confirm' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs transition-colors">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider">
                  {t('report.review_complaint', 'Review Complaint Summary')}
                </h3>

                {previewUrl && (
                  <div className="h-48 sm:h-56 w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                    <img
                      src={previewUrl}
                      alt="Complaint Preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                      {t('report.detected_problem', 'Problem Type')}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 mt-0.5 block truncate">
                      {getProblemLabel(editedProblemType, t)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                      {t('report.visual_severity', 'Visual Severity')}
                    </span>
                    <div className="mt-1">
                      <SeverityBadge severity={editedSeverity} size="sm" />
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                      {t('report.department', 'Department')}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                      {aiResult?.suggested_department || 'Municipal Corporation'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                      {t('report.location_title', 'Location')}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                      {locationName}
                    </span>
                  </div>
                </div>

                {description && (
                  <div className="text-xs bg-slate-50 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider mb-0.5">
                      Citizen Notes:
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">{description}</span>
                  </div>
                )}

                {/* Reporting Citizen Info */}
                {citizen && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <span>{t('auth.profile', 'Reporting Citizen')}</span>
                      <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded font-medium border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1">
                        <CheckCircle2 size={11} />
                        {t('auth.verified_citizen', 'Verified')}
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white">{citizen.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{citizen.email}</div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setCurrentStep('location')}
                  className="w-full sm:flex-1 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer text-center"
                >
                  {t('report.back', 'Back')}
                </button>
                <button
                  type="button"
                  onClick={handleSubmitComplaint}
                  disabled={isSubmitting}
                  className="w-full sm:flex-1 py-3 bg-[#0B2545] hover:bg-[#07192f] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{t('report.submit_complaint', 'Submit Complaint')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ================= SUBMITTING STATE ================= */}
          {currentStep === 'submitting' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-xs transition-colors">
              <Loader2 size={36} className="animate-spin text-[#0B2545] dark:text-blue-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Submitting complaint...
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Generating official tracking reference ID and dispatching notification to municipal zone authorities.
                </p>
              </div>
            </div>
          )}

          {/* ================= SUCCESS STATE ================= */}
          {currentStep === 'success' && submittedComplaint && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 text-center space-y-5 shadow-xs transition-colors">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 size={30} />
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t('report.created_title', 'Complaint Filed Successfully!')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('report.created_desc', 'Your civic issue has been officially logged with municipal authorities.')}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-1.5">
                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  {t('report.report_id', 'Official Report ID')}
                </div>
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tracking-wider">
                  {submittedComplaint.report_id}
                </div>
                <div className="flex items-center justify-center gap-2 pt-1 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{t('report.status', 'Status')}:</span>
                  <StatusBadge status={submittedComplaint.status} />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => onSuccess(submittedComplaint)}
                  className="w-full py-2.5 bg-[#0B2545] hover:bg-[#07192f] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  {t('report.track_btn', 'Track in My Reports')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setAiResult(null);
                    setCurrentStep('capture');
                  }}
                  className="w-full py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-medium text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  {t('report.another_btn', 'File Another Report')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR (4 cols on desktop) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card 1: Quick Tips */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-colors">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Lightbulb size={16} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                {t('tips.title', 'Quick Tips')}
              </h3>
            </div>

            <ul className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <li className="flex items-start gap-2.5">
                <Check size={15} className="text-slate-900 dark:text-white stroke-[2.5] shrink-0 mt-0.5" />
                <span>{t('tips.tip1', 'Use clear and focused photos')}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={15} className="text-slate-900 dark:text-white stroke-[2.5] shrink-0 mt-0.5" />
                <span>{t('tips.tip2', 'Add a precise location')}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={15} className="text-slate-900 dark:text-white stroke-[2.5] shrink-0 mt-0.5" />
                <span>{t('tips.tip3', 'Provide a short description')}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={15} className="text-slate-900 dark:text-white stroke-[2.5] shrink-0 mt-0.5" />
                <span>{t('tips.tip4', 'Choose the correct category')}</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Help us build cleaner, safer cities */}
          <div className="bg-[#F0FDF4] dark:bg-emerald-950/30 border border-[#DCFCE7] dark:border-emerald-900/60 rounded-2xl p-5 shadow-xs transition-colors">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <MapPin size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-100 leading-snug">
                  {t('mission.title', 'Help us build cleaner, safer cities')}
                </h3>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed mt-2 font-normal">
                  {t('mission.desc', 'Your report makes a difference. Together we can create better places for everyone.')}
                </p>
              </div>
            </div>

            {/* Indian Flag & Initiatives */}
            <div className="mt-5 pt-3.5 border-t border-emerald-200/60 dark:border-emerald-900/60 flex items-center gap-3">
              <IndianFlagGraphic className="w-9 h-6 shrink-0" />
              <div className="flex flex-col text-[11px] leading-tight">
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {t('mission.swachh_bharat', 'Swachh Bharat')}
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {t('mission.smart_cities', 'Smart Cities')}
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {t('mission.viksit_bharat', 'Viksit Bharat')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
