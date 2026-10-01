import { useEffect, useMemo, useState, useCallback } from 'react';
import type {
  Complaint,
  ComplaintStatus,
  DashboardStatistics,
  Department,
  HeatmapPoint,
  HotspotInfo,
} from './types/complaint';
import {
  getComplaints,
  getDashboardHeatmap,
  getDashboardStatistics,
  getDepartments,
  resolveComplaint,
  updateComplaintStatus,
  assignComplaint,
  addInternalNote,
  acknowledgeStatusUpdateRequest,
  getComplaintById,
} from './services/api';
import { supabase } from './services/supabaseClient';
import { Sidebar, type AuthorityRoute } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { NagarDrishtiLogo } from './components/NagarDrishtiLogo';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ComplaintDrawer } from './components/ComplaintDrawer';
import { AuthorityLanding } from './pages/AuthorityLanding';
import { CommandCenter } from './pages/CommandCenter';
import { ComplaintQueue } from './pages/ComplaintQueue';
import { MapIntelligence } from './pages/MapIntelligence';
import { HotspotIntelligence } from './pages/HotspotIntelligence';
import { LoginPage } from './pages/LoginPage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { MapMode } from './components/LeafletMap';


export type AppRoute = AuthorityRoute | '/login' | '/access-denied';

function AuthorityAppContent() {
  const { session, user, loading: authLoading, isAuthority, logout } = useAuth();

  const parseRoute = useCallback((): AppRoute => {
    const hashRaw = window.location.hash.replace(/^#\/?/, '');
    const pathRaw = window.location.pathname.replace(/^\//, '');
    const cleanPath = pathRaw === 'index.html' ? '' : pathRaw;
    const target = hashRaw ? `/${hashRaw}` : (cleanPath ? `/${cleanPath}` : '/');

    if (target === '/login' || target === '/access-denied') {
      return target;
    }
    if (
      target === '/dashboard' ||
      target === '/reports' ||
      target === '/map' ||
      target === '/hotspots'
    ) {
      return target as AuthorityRoute;
    }
    if (target === '/' || target === '') {
      return '/';
    }
    return '/dashboard';
  }, []);

  // Routing state
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(parseRoute);

  // Backend state
  const [stats, setStats] = useState<DashboardStatistics | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [heatmapPoints, setHeatmapPoints] = useState<HeatmapPoint[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Master Filter state
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [resolutionStatusFilter, setResolutionStatusFilter] = useState<string>('');
  const [priorityLevelFilter, setPriorityLevelFilter] = useState<string>('');
  const [dateHorizon, setDateHorizon] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Map and Selection state
  const [mapMode, setMapMode] = useState<MapMode>('markers');
  const [focusedHotspot, setFocusedHotspot] = useState<HotspotInfo | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  // Responsive Navigation State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Navigate helper
  const navigateTo = useCallback((route: AppRoute) => {
    setCurrentRoute(route);
    const targetHash = route === '/' ? '' : `#${route.startsWith('/') ? route : `/${route}`}`;
    if (window.location.hash !== targetHash) {
      if (!targetHash && window.location.hash) {
        window.history.pushState({}, '', window.location.pathname);
      } else {
        window.location.hash = targetHash;
      }
    }
  }, []);

  // Sync routing from URL path / hash
  useEffect(() => {
    setCurrentRoute(parseRoute());

    const handlePopState = () => {
      setCurrentRoute(parseRoute());
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, [parseRoute]);

  // Route guarding based on auth session and role
  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      // Unauthenticated users must be redirected to /login
      if (currentRoute !== '/login') {
        navigateTo('/login');
      }
      return;
    }

    // Role verification in progress - do not redirect until user role is established
    if (!user) {
      return;
    }

    // Authenticated user exists: check role
    if (!isAuthority) {
      // User is authenticated citizen attempting authority portal access
      if (currentRoute !== '/access-denied') {
        navigateTo('/access-denied');
      }
      return;
    }

    // Authenticated authority user
    if (currentRoute === '/login' || currentRoute === '/access-denied') {
      navigateTo('/dashboard');
    }
  }, [authLoading, session, user, isAuthority, currentRoute, navigateTo]);

  // Fetch backend records (strictly with authority access token)
  const loadData = useCallback(async (showLoadingSpinner = false) => {
    if (!session || !isAuthority) return;

    if (showLoadingSpinner) setLoading(true);
    setIsRefreshing(true);
    try {
      const [statsData, complaintsData, heatmapData, deptsData] = await Promise.all([
        getDashboardStatistics(),
        getComplaints(),
        getDashboardHeatmap(),
        getDepartments(),
      ]);
      setStats(statsData);
      setComplaints(complaintsData);
      setHeatmapPoints(heatmapData);
      setDepartments(deptsData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load authority records', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [session, isAuthority]);

  useEffect(() => {
    if (!authLoading && session && isAuthority) {
      loadData(true);
    }
  }, [authLoading, session, isAuthority, loadData]);

  // Real-time Supabase postgres_changes subscription + periodic polling safeguard
  useEffect(() => {
    if (!session || !isAuthority) return;

    const channel = typeof supabase.channel === 'function'
      ? supabase
          .channel('authority-realtime-complaints')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'complaints' },
            () => {
              loadData(false);
            }
          )
          .subscribe()
      : null;

    const pollTimer = setInterval(() => {
      loadData(false);
    }, 10000);

    return () => {
      if (channel && typeof supabase.removeChannel === 'function') {
        supabase.removeChannel(channel);
      }
      clearInterval(pollTimer);
    };
  }, [session, isAuthority, loadData]);

  // Reset master filters
  const handleResetFilters = () => {
    setCategoryFilter('');
    setSeverityFilter('');
    setStatusFilter('');
    setDepartmentFilter('');
    setResolutionStatusFilter('');
    setPriorityLevelFilter('');
    setDateHorizon('all');
    setSearchQuery('');
    setFocusedHotspot(null);
  };

  // Filter complaints based on master criteria
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (categoryFilter && c.problem_type.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }
      if (severityFilter && c.severity.toUpperCase() !== severityFilter.toUpperCase()) {
        return false;
      }
      if (statusFilter && c.status.toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }
      if (departmentFilter && c.department !== departmentFilter) {
        return false;
      }
      if (priorityLevelFilter && c.priority_level !== priorityLevelFilter) {
        return false;
      }
      if (resolutionStatusFilter) {
        const resFilter = resolutionStatusFilter.toLowerCase();
        if (resFilter === 'pending_resolution') {
          if (c.status === 'RESOLVED') return false;
        } else if (resFilter === 'resolved') {
          if (c.status !== 'RESOLVED') return false;
        } else if (resFilter === 'awaiting_verification') {
          if (c.status !== 'RESOLVED' || c.citizen_verification_status !== 'PENDING') return false;
        } else if (resFilter === 'citizen_confirmed') {
          if (c.citizen_verification_status !== 'CONFIRMED') return false;
        } else if (resFilter === 'reopened') {
          if (c.status !== 'REOPENED' && c.citizen_verification_status !== 'REOPENED') return false;
        }
      }
      if (dateHorizon !== 'all') {
        const itemDate = new Date(c.created_at).getTime();
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        if (dateHorizon === 'today' && now - itemDate > oneDay) {
          return false;
        }
        if (dateHorizon === '7d' && now - itemDate > 7 * oneDay) {
          return false;
        }
        if (dateHorizon === '30d' && now - itemDate > 30 * oneDay) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchId = c.report_id.toLowerCase().includes(query);
        const matchLoc = (c.location_name || '').toLowerCase().includes(query);
        const matchDesc = (c.description || '').toLowerCase().includes(query);
        const matchDept = (c.department || '').toLowerCase().includes(query);
        if (!matchId && !matchLoc && !matchDesc && !matchDept) {
          return false;
        }
      }
      return true;
    });
  }, [complaints, categoryFilter, severityFilter, statusFilter, departmentFilter, priorityLevelFilter, resolutionStatusFilter, dateHorizon, searchQuery]);

  // Update status action handler with Phase 5 resolution support
  const handleUpdateStatus = async (
    id: string,
    newStatus: ComplaintStatus,
    resolutionData?: { resolution_image_url?: string; resolution_note?: string }
  ) => {
    let updated: Complaint;
    if (newStatus === 'RESOLVED' && resolutionData?.resolution_image_url) {
      updated = await resolveComplaint(id, resolutionData.resolution_image_url, resolutionData.resolution_note);
    } else {
      updated = await updateComplaintStatus(id, newStatus);
    }
    setComplaints((prev) => prev.map((item) => (item.id === id ? updated : item)));
    if (selectedComplaint && selectedComplaint.id === id) {
      setSelectedComplaint(updated);
    }
    getDashboardStatistics().then((s) => setStats(s)).catch(() => {});
  };

  // Phase 7: Operational Case Assignment handler
  const handleAssignComplaint = async (
    id: string,
    payload: { department: string; assigned_to: string; note?: string }
  ) => {
    const updated = await assignComplaint(id, payload);
    setComplaints((prev) => prev.map((item) => (item.id === id ? updated : item)));
    if (selectedComplaint && selectedComplaint.id === id) {
      setSelectedComplaint(updated);
    }
    getDashboardStatistics().then((s) => setStats(s)).catch(() => {});
  };

  // Phase 7: Internal Confidential Note handler
  const handleAddInternalNote = async (id: string, note: string) => {
    await addInternalNote(id, note);
    const refreshed = await getComplaintById(id);
    setComplaints((prev) => prev.map((item) => (item.id === id ? refreshed : item)));
    if (selectedComplaint && selectedComplaint.id === id) {
      setSelectedComplaint(refreshed);
    }
  };

  // Phase 7: Citizen Status Request Acknowledgment handler
  const handleAcknowledgeStatusRequest = async (
    complaintId: string,
    requestId: string,
    responseNote?: string
  ) => {
    await acknowledgeStatusUpdateRequest(complaintId, requestId, responseNote);
    const refreshed = await getComplaintById(complaintId);
    setComplaints((prev) => prev.map((item) => (item.id === complaintId ? refreshed : item)));
    if (selectedComplaint && selectedComplaint.id === complaintId) {
      setSelectedComplaint(refreshed);
    }
  };

  // Handle Jump to Duplicate Original
  const handleSelectDuplicate = (duplicateReportId: string) => {
    const found = complaints.find(
      (c) => c.report_id === duplicateReportId || c.id === duplicateReportId
    );
    if (found) {
      setSelectedComplaint(found);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigateTo('/login');
  };

  // Render Loading Splash while verifying initial session
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 select-none">
        <NagarDrishtiLogo size={48} className="mb-3" />
        <p className="text-sm font-semibold tracking-wide">NagarDrishti AI Authority</p>
        <p className="text-xs text-slate-500 mt-1">Verifying municipal session security...</p>
      </div>
    );
  }

  // 1. Unauthenticated or explicitly on /login -> Login Page
  if (!session || currentRoute === '/login') {
    return (
      <LoginPage
        onLoginSuccess={() => navigateTo('/dashboard')}
        onAccessDenied={() => navigateTo('/access-denied')}
      />
    );
  }

  // 2. Explicitly on /access-denied route
  if (currentRoute === '/access-denied') {
    return <AccessDeniedPage onBackToLogin={() => navigateTo('/login')} />;
  }

  // 3. User session exists but profile still resolving (transitional state)
  if (!user || !isAuthority) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 select-none">
        <NagarDrishtiLogo size={48} className="mb-3" />
        <p className="text-sm font-semibold tracking-wide">NagarDrishti AI Authority</p>
        <p className="text-xs text-slate-500 mt-1">Verifying municipal session security...</p>
      </div>
    );
  }

  // 3. Authorized Municipal Officer -> Authority Portal Layout
  const getPageTitle = (route: AppRoute) => {
    switch (route) {
      case '/':
        return 'Portal Overview';
      case '/dashboard':
        return 'Command Center';
      case '/reports':
        return 'Complaint Queue';
      case '/map':
        return 'Map Intelligence';
      case '/hotspots':
        return 'Hotspot Intelligence';
      default:
        return 'Authority Portal';
    }
  };

  const authorityRoute: AuthorityRoute =
    currentRoute === '/' ||
    currentRoute === '/dashboard' ||
    currentRoute === '/reports' ||
    currentRoute === '/map' ||
    currentRoute === '/hotspots'
      ? currentRoute
      : '/dashboard';

  return (
    <div className="flex min-h-screen lg:h-screen lg:overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-150">
      {/* Sidebar Navigation */}
      <Sidebar
        currentRoute={authorityRoute}
        onRouteChange={(r) => navigateTo(r)}
        onLogout={handleLogout}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0 scroll-touch h-full">
        {/* Top Navbar */}
        <Navbar
          title={getPageTitle(currentRoute)}
          subtitle="Municipal Civic Intelligence"
          onRefresh={() => loadData(false)}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          onLogout={handleLogout}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        {/* Route Pages */}
        <main className="flex-1">
          {currentRoute === '/' && (
            <AuthorityLanding
              onOpenDashboard={() => navigateTo('/dashboard')}
              stats={stats}
            />
          )}

          {currentRoute === '/dashboard' && (
            <CommandCenter
              stats={stats}
              complaints={filteredComplaints}
              heatmapPoints={heatmapPoints}
              departments={departments}
              loading={loading}
              onSelectComplaint={(c) => setSelectedComplaint(c)}
              onSelectHotspot={(h) => {
                setFocusedHotspot(h);
                navigateTo('/map');
              }}
              focusedHotspot={focusedHotspot}
              mapMode={mapMode}
              onMapModeChange={setMapMode}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              severityFilter={severityFilter}
              onSeverityFilterChange={setSeverityFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              departmentFilter={departmentFilter}
              onDepartmentFilterChange={setDepartmentFilter}
              resolutionStatusFilter={resolutionStatusFilter}
              onResolutionStatusFilterChange={setResolutionStatusFilter}
              priorityLevelFilter={priorityLevelFilter}
              onPriorityLevelFilterChange={setPriorityLevelFilter}
              dateHorizon={dateHorizon}
              onDateHorizonChange={setDateHorizon}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onResetFilters={handleResetFilters}
              onNavigateToReports={() => navigateTo('/reports')}
              onNavigateToHotspots={() => navigateTo('/hotspots')}
            />
          )}

          {currentRoute === '/reports' && (
            <ComplaintQueue
              complaints={filteredComplaints}
              departments={departments}
              loading={loading}
              onSelectComplaint={(c) => setSelectedComplaint(c)}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              severityFilter={severityFilter}
              onSeverityFilterChange={setSeverityFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              departmentFilter={departmentFilter}
              onDepartmentFilterChange={setDepartmentFilter}
              resolutionStatusFilter={resolutionStatusFilter}
              onResolutionStatusFilterChange={setResolutionStatusFilter}
              priorityLevelFilter={priorityLevelFilter}
              onPriorityLevelFilterChange={setPriorityLevelFilter}
              dateHorizon={dateHorizon}
              onDateHorizonChange={setDateHorizon}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onResetFilters={handleResetFilters}
            />
          )}

          {currentRoute === '/map' && (
            <MapIntelligence
              complaints={filteredComplaints}
              heatmapPoints={heatmapPoints}
              departments={departments}
              hotspots={stats?.hotspots || []}
              mapMode={mapMode}
              onMapModeChange={setMapMode}
              onSelectComplaint={(c) => setSelectedComplaint(c)}
              focusedHotspot={focusedHotspot}
              onSelectHotspot={setFocusedHotspot}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              severityFilter={severityFilter}
              onSeverityFilterChange={setSeverityFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              departmentFilter={departmentFilter}
              onDepartmentFilterChange={setDepartmentFilter}
              resolutionStatusFilter={resolutionStatusFilter}
              onResolutionStatusFilterChange={setResolutionStatusFilter}
              priorityLevelFilter={priorityLevelFilter}
              onPriorityLevelFilterChange={setPriorityLevelFilter}
              dateHorizon={dateHorizon}
              onDateHorizonChange={setDateHorizon}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onResetFilters={handleResetFilters}
            />
          )}

          {currentRoute === '/hotspots' && (
            <HotspotIntelligence
              hotspots={stats?.hotspots || []}
              allComplaints={complaints}
              onSelectHotspot={(h) => {
                setFocusedHotspot(h);
              }}
              onNavigateToMap={() => navigateTo('/map')}
              onSelectComplaint={(c) => setSelectedComplaint(c)}
            />
          )}
        </main>
      </div>

      {/* Complaint Detail Inspection Drawer */}
      <ComplaintDrawer
        complaint={selectedComplaint}
        onClose={() => setSelectedComplaint(null)}
        onUpdateStatus={handleUpdateStatus}
        onSelectDuplicate={handleSelectDuplicate}
        onAssignComplaint={handleAssignComplaint}
        onAddInternalNote={handleAddInternalNote}
        onAcknowledgeStatusRequest={handleAcknowledgeStatusRequest}
        departments={departments}
      />

      {/* Bottom Navigation Dock for Mobile (Screens < 1024px) */}
      {currentRoute !== '/' && (
        <MobileBottomNav
          currentRoute={authorityRoute}
          onRouteChange={(r) => navigateTo(r)}
        />
      )}
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AuthorityAppContent />
    </AuthProvider>
  );
}

export default App;
