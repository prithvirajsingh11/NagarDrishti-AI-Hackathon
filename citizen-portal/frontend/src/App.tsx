import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Complaint } from './types/complaint';
import { Navbar } from './components/Navbar';
import { Sidebar, type NavView } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Footer } from './components/Footer';
import { CitizenHome } from './pages/CitizenHome';
import { ReportFlow } from './pages/ReportFlow';
import { MyReports } from './pages/MyReports';
import { CivicMap } from './pages/CivicMap';
import { HelpSupport } from './pages/HelpSupport';
import { PublicStatusTracker } from './pages/PublicStatusTracker';
import { AuthPage, type AuthMode } from './pages/AuthPage';
import { AuthorityDashboard } from './pages/AuthorityDashboard';
import { useAuth } from './context/AuthContext';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export function App() {
  const { isLoggedIn, loading } = useAuth();
  // Default to 'home' for first-time visitors
  const [currentView, setCurrentView] = useState<NavView>('home');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [previousView, setPreviousView] = useState<NavView>('home');
  const [authReturnTo, setAuthReturnTo] = useState<NavView | null>(null);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [trackReportId, setTrackReportId] = useState<string | null>(null);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync with browser hash if user navigates via URL
  useEffect(() => {
    if (loading) return; // Wait until initial session resolution to avoid flashing

    const handleHashChange = () => {
      const rawHash = window.location.hash.replace('#', '');
      const [viewPart, queryPart] = rawHash.split('?');
      const hash = viewPart.toLowerCase();

      // Check query parameter for deep-linked tracking
      if (queryPart) {
        const qp = new URLSearchParams(queryPart);
        const refId = qp.get('id') || qp.get('report_id') || qp.get('track');
        if (refId) {
          setTrackReportId(refId.toUpperCase());
        }
      }

      if (hash === 'track') {
        setCurrentView('track');
        return;
      } else if (hash === 'report') {
        if (!isLoggedIn) {
          setAuthReturnTo('report');
          setAuthMode('login');
          setCurrentView('auth');
          return;
        }
        setCurrentView('report');
      } else if (hash === 'my-reports') {
        if (!isLoggedIn) {
          setAuthReturnTo('my-reports');
          setAuthMode('login');
          setCurrentView('auth');
          return;
        }
        setCurrentView('my-reports');
      } else if (hash === 'map') {
        setCurrentView('map');
      } else if (hash === 'authority') {
        setCurrentView('authority');
      } else if (hash === 'help') {
        setCurrentView('help');
      } else if (hash === 'home') {
        setCurrentView('home');
      } else if (
        hash === 'login' ||
        hash === 'signup' ||
        hash === 'forgot-password' ||
        hash === 'auth'
      ) {
        if (isLoggedIn) {
          // Citizen is already authenticated: transition out of auth immediately
          const dest = authReturnTo || (previousView === 'auth' ? 'report' : previousView);
          setAuthReturnTo(null);
          setCurrentView(dest);
          if (window.location.hash) {
            window.location.hash = dest;
          }
          return;
        }
        if (hash === 'signup') setAuthMode('signup');
        else if (hash === 'forgot-password') setAuthMode('forgot-password');
        else setAuthMode('login');
        setCurrentView('auth');
      } else {
        // Default to home for clean landing experience
        setCurrentView('home');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isLoggedIn, loading, authReturnTo, previousView]);

  // Android Native Hardware/Gesture Back Button Handling
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let backHandle: any = null;
    CapApp.addListener('backButton', ({ canGoBack }) => {
      // 1. If mobile menu/drawer is open, close it
      if (mobileMenuOpen) {
        setMobileMenuOpen(false);
        return;
      }
      // 2. If inside subviews, navigate back to home
      if (currentView !== 'home') {
        if (currentView === 'report') {
          // Check step handling or return to home
          navigateTo('home');
        } else {
          navigateTo('home');
        }
        return;
      }
      // 3. If on home and cannot go back in history, exit app
      if (!canGoBack) {
        CapApp.exitApp();
      } else {
        window.history.back();
      }
    }).then((handle) => {
      backHandle = handle;
    });

    return () => {
      if (backHandle) {
        backHandle.remove();
      }
    };
  }, [mobileMenuOpen, currentView]);

  // Reactive auto-redirect: whenever authenticated citizen is on 'auth' view, immediately redirect
  useEffect(() => {
    if (!loading && isLoggedIn && currentView === 'auth') {
      const dest = authReturnTo || (previousView === 'auth' ? 'report' : previousView);
      setAuthReturnTo(null);
      setCurrentView(dest);
      window.location.hash = dest;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isLoggedIn, loading, currentView, authReturnTo, previousView]);

  const navigateTo = (view: NavView, mode?: AuthMode, reportId?: string) => {
    if (mode) {
      setAuthMode(mode);
    }
    if (reportId) {
      setSelectedComplaintId(reportId);
    }

    if (view === 'track') {
      if (reportId) {
        setTrackReportId(reportId.toUpperCase());
      }
      setPreviousView(currentView !== 'auth' ? currentView : 'track');
      setCurrentView('track');
      window.location.hash = reportId ? `track?id=${encodeURIComponent(reportId.toUpperCase())}` : 'track';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Intercept protected views if citizen is not authenticated
    if ((view === 'report' || view === 'my-reports') && !isLoggedIn) {
      setAuthReturnTo(view);
      setAuthMode(mode || 'login');
      setPreviousView(currentView !== 'auth' ? currentView : 'report');
      setCurrentView('auth');
      window.location.hash = mode || 'login';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // If citizen is logged in and tries to navigate to auth, redirect to destination
    if (view === 'auth' && isLoggedIn) {
      const dest = authReturnTo || (previousView === 'auth' ? 'report' : previousView);
      setAuthReturnTo(null);
      setCurrentView(dest);
      window.location.hash = dest;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (view !== 'auth') {
      setPreviousView(view);
    }
    setCurrentView(view);
    window.location.hash = view;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReportSuccess = (complaint: Complaint) => {
    setSelectedComplaintId(complaint.id);
    navigateTo('my-reports');
  };

  const handleSelectComplaintFromFeed = (complaint: Complaint) => {
    setSelectedComplaintId(complaint.id);
    navigateTo('my-reports');
  };

  // Prevent flash of protected content while initial session restores
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B2545] dark:text-blue-400" />
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Initializing NagarDrishti AI...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased transition-colors duration-200 overflow-x-hidden w-full max-w-full">
      {/* Top Header Navbar */}
      <Navbar
        currentView={currentView}
        onNavigate={navigateTo}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
      />

      {/* Main Container with Sidebar + Content */}
      <div className="w-full flex-1 max-w-[1520px] mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 pb-2 sm:pb-6 flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar (visible on desktop) */}
        {currentView !== 'auth' && (
          <Sidebar
            currentView={currentView}
            onNavigate={navigateTo}
            className="hidden lg:flex"
          />
        )}

        {/* Content Area */}
        <main className="flex-1 min-w-0">
          {currentView === 'home' && (
            <CitizenHome
              onStartReport={() => navigateTo('report')}
              onSelectComplaint={handleSelectComplaintFromFeed}
            />
          )}

          {currentView === 'report' && (
            <ReportFlow
              onCancel={() => navigateTo('home')}
              onSuccess={handleReportSuccess}
              onRequireAuth={() => {
                setAuthReturnTo('report');
                setAuthErrorMessage('Please sign in or register to report civic issues.');
                navigateTo('auth', 'login');
              }}
            />
          )}

          {currentView === 'my-reports' && (
            <MyReports
              onStartNewReport={() => navigateTo('report')}
              selectedComplaintId={selectedComplaintId}
            />
          )}

          {currentView === 'map' && (
            <CivicMap onReportNew={() => navigateTo('report')} />
          )}

          {currentView === 'authority' && <AuthorityDashboard />}

          {currentView === 'track' && (
            <PublicStatusTracker
              initialReportId={trackReportId}
              onNavigateHome={() => navigateTo('home')}
              onNavigateReport={() => navigateTo('report')}
            />
          )}

          {currentView === 'help' && <HelpSupport />}

          {currentView === 'auth' && (
            <AuthPage
              initialMode={authMode}
              reason={authReturnTo === 'report' ? 'report' : 'default'}
              initialError={authErrorMessage}
              onSuccess={() => {
                setAuthErrorMessage(null);
                const dest = authReturnTo || (previousView === 'auth' ? 'report' : previousView);
                setAuthReturnTo(null);
                navigateTo(dest);
              }}
              onCancel={() => {
                setAuthErrorMessage(null);
                setAuthReturnTo(null);
                navigateTo(previousView === 'auth' ? 'report' : previousView);
              }}
            />
          )}
        </main>
      </div>

      {/* Footer */}
      <Footer />

      {/* Mobile Bottom Navigation (Visible on phones & tablets, hidden on lg desktop) */}
      {currentView !== 'auth' && !mobileMenuOpen && (
        <MobileBottomNav
          currentView={currentView}
          onNavigate={navigateTo}
          onOpenMenu={() => setMobileMenuOpen(true)}
        />
      )}
    </div>
  );
}

export default App;
