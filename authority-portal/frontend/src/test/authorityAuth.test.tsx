import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LoginPage } from '../pages/LoginPage';
import { AccessDeniedPage } from '../pages/AccessDeniedPage';
import { AuthProvider, useAuth } from '../context/AuthContext';
import {
  getComplaints,
  getDashboardStatistics,
  updateComplaintStatus,
  getDashboardHotspots,
  registerSessionExpiryHandler,
} from '../services/api';
import { supabase } from '../services/supabaseClient';
import { CommandCenter } from '../pages/CommandCenter';
import { ComplaintQueue } from '../pages/ComplaintQueue';
import { HotspotIntelligence } from '../pages/HotspotIntelligence';
import { Sidebar } from '../components/Sidebar';
import { ThemeProvider } from '../context/ThemeContext';
import { App } from '../App';

// Mock Supabase Auth
vi.mock('../services/supabaseClient', () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        refreshSession: vi.fn(),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: 'authority', full_name: 'Municipal Officer' }, error: null }),
      })),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
    },
  };
});

describe('NagarDrishti AI Authority Portal - Authentication & Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // 1. Authority Login
  it('1. authority login: authenticates via Supabase Auth and triggers success for authority role', async () => {
    const onLoginSuccess = vi.fn();
    const onAccessDenied = vi.fn();

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: {
        session: {
          access_token: 'test-authority-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'refresh-token',
          user: {
            id: 'auth-user-1',
            email: 'officer@municipal.gov',
            app_metadata: {},
            user_metadata: { full_name: 'Officer Raj' },
            aud: 'authenticated',
            created_at: '2026-01-01',
          },
        } as any,
        user: {
          id: 'auth-user-1',
          email: 'officer@municipal.gov',
        } as any,
      },
      error: null,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'auth-user-1',
        email: 'officer@municipal.gov',
        role: 'authority',
        full_name: 'Officer Raj',
      }),
    });

    render(
      <AuthProvider>
        <LoginPage onLoginSuccess={onLoginSuccess} onAccessDenied={onAccessDenied} />
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'officer@municipal.gov' },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: 'SecurePass123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'officer@municipal.gov',
        password: 'SecurePass123!',
      });
      expect(onLoginSuccess).toHaveBeenCalled();
      expect(onAccessDenied).not.toHaveBeenCalled();
    });
  });

  // 2. Logout
  it('2. logout: calls supabase.auth.signOut and resets active state', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    const TestComponent = () => {
      const { logout } = useAuth();
      return <button onClick={logout}>Sign Out Button</button>;
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Sign Out Button'));

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });
  });

  // 3. Unauthenticated portal access
  it('3. unauthenticated portal access: renders login prompt without leaking dashboard', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(
      <AuthProvider>
        <LoginPage onLoginSuccess={vi.fn()} onAccessDenied={vi.fn()} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Authority Portal')).toBeInTheDocument();
    });
    expect(screen.getByText('Municipal Civic Intelligence')).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    // Public signup must not exist
    expect(screen.queryByText(/Sign Up/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Register/i)).not.toBeInTheDocument();
  });

  // 4. Citizen account access denied
  it('4. citizen account access denied: redirects citizen role to /access-denied', async () => {
    const onLoginSuccess = vi.fn();
    const onAccessDenied = vi.fn();

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: {
        session: {
          access_token: 'test-citizen-token',
          user: {
            id: 'cit-1',
            email: 'citizen@example.com',
            user_metadata: {},
          },
        } as any,
        user: { id: 'cit-1', email: 'citizen@example.com' } as any,
      },
      error: null,
    });

    // Backend returns citizen role
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'cit-1',
        email: 'citizen@example.com',
        role: 'citizen',
        full_name: 'Verified Citizen',
      }),
    });

    render(
      <AuthProvider>
        <LoginPage onLoginSuccess={onLoginSuccess} onAccessDenied={onAccessDenied} />
      </AuthProvider>
    );

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'citizen@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: 'Password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(onAccessDenied).toHaveBeenCalled();
      expect(onLoginSuccess).not.toHaveBeenCalled();
    });
  });

  // 5. Authority account access allowed
  it('5. authority account access allowed: verifies isAuthority flag in AuthContext', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: 'valid-authority-token',
          user: { id: 'officer-1', email: 'officer@municipal.gov' },
        } as any,
      },
      error: null,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'officer-1',
        email: 'officer@municipal.gov',
        role: 'authority',
        full_name: 'Officer Sharma',
      }),
    });

    const TestGuard = () => {
      const { isAuthority, user, loading } = useAuth();
      if (loading) return <div>Loading...</div>;
      return (
        <div>
          <span>Role: {user?.role}</span>
          <span>Access: {isAuthority ? 'GRANTED' : 'DENIED'}</span>
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestGuard />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Role: authority')).toBeInTheDocument();
      expect(screen.getByText('Access: GRANTED')).toBeInTheDocument();
    });
  });

  // 6. Invalid token rejected
  it('6. invalid token rejected: 401 unauthorized response triggers session expiry handler', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: 'expired-invalid-token',
          user: { id: 'user-1', email: 'user@example.com' },
        } as any,
      },
      error: null,
    });

    const expiryHandler = vi.fn();
    registerSessionExpiryHandler(expiryHandler);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid or expired session. Please sign in again.' }),
    });

    await expect(getComplaints()).rejects.toThrow(/session has expired/i);
    expect(expiryHandler).toHaveBeenCalled();
  });

  // 7. Authority dashboard API access
  it('7. authority dashboard API access: attaches Authorization Bearer header to requests', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: 'auth-jwt-token-12345',
          user: { id: 'user-1' },
        } as any,
      },
      error: null,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        total_reports: 5,
        high_critical: 2,
        pending: 1,
        in_progress: 1,
        resolved: 1,
        by_category: { pothole: 5 },
        by_severity: { HIGH: 2, MEDIUM: 3 },
        by_status: { REPORTED: 1, RESOLVED: 1 },
        hotspots: [],
        daily_trends: [],
      }),
    });

    await getDashboardStatistics();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/dashboard/statistics'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer auth-jwt-token-12345',
        }),
      })
    );
  });

  // 8. Citizen token rejected from authority endpoint
  it('8. citizen token rejected: 403 Forbidden is thrown when caller lacks authority role', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: 'test-citizen-token',
          user: { id: 'cit-1' },
        } as any,
      },
      error: null,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ detail: 'Authority role required. Citizens are not permitted to access this resource.' }),
    });

    await expect(getDashboardHotspots()).rejects.toThrow(/Authority role required/i);
  });

  // 9. Authority status update
  it('9. authority status update: sends PATCH with auth header and valid lifecycle status', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: 'authority-token',
          user: { id: 'officer-1' },
        } as any,
      },
      error: null,
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'comp-uuid-1',
        report_id: 'ND-2026-0001',
        status: 'IN_PROGRESS',
      }),
    });

    const res = await updateComplaintStatus('comp-uuid-1', 'IN_PROGRESS');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/complaints/comp-uuid-1/status'),
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer authority-token',
        }),
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      })
    );
    expect(res.status).toBe('IN_PROGRESS');
  });

  // 10. Logout / session cleanup
  it('10. logout / session cleanup: AccessDenied page provides clean logout and return to login', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });
    const onBackToLogin = vi.fn();

    render(
      <AuthProvider>
        <AccessDeniedPage onBackToLogin={onBackToLogin} />
      </AuthProvider>
    );

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.getByText(/This portal is available only to authorized municipal authority users/i)).toBeInTheDocument();

    const backButton = screen.getByRole('button', { name: /Back to Login/i });
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(onBackToLogin).toHaveBeenCalled();
    });
  });

  // 11. Zero-data dashboard
  it('11. zero-data dashboard: renders "No civic reports yet" with 0 real records', () => {
    const zeroStats = {
      total_reports: 0,
      high_critical: 0,
      pending: 0,
      in_progress: 0,
      resolved: 0,
      by_category: {},
      by_severity: {},
      by_status: {},
      hotspots: [],
      daily_trends: [],
    };

    // Render CommandCenter
    const { unmount: unmountCommandCenter } = render(
      <ThemeProvider>
        <CommandCenter
          stats={zeroStats}
          complaints={[]}
          heatmapPoints={[]}
          departments={[]}
          loading={false}
          onSelectComplaint={vi.fn()}
          onSelectHotspot={vi.fn()}
          focusedHotspot={null}
          mapMode="markers"
          onMapModeChange={vi.fn()}
          categoryFilter=""
          onCategoryFilterChange={vi.fn()}
          severityFilter=""
          onSeverityFilterChange={vi.fn()}
          statusFilter=""
          onStatusFilterChange={vi.fn()}
          departmentFilter=""
          onDepartmentFilterChange={vi.fn()}
          dateHorizon="all"
          onDateHorizonChange={vi.fn()}
          searchQuery=""
          onSearchQueryChange={vi.fn()}
          onResetFilters={vi.fn()}
          onNavigateToReports={vi.fn()}
          onNavigateToHotspots={vi.fn()}
        />
      </ThemeProvider>
    );

    // Verify 0 reports rendered across KPI cards, not fake numbers
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(7);
    expect(screen.getAllByText('No civic reports yet').length).toBeGreaterThanOrEqual(1);
    unmountCommandCenter();

    // Render ComplaintQueue empty state
    const { unmount: unmountQueue } = render(
      <ComplaintQueue
        complaints={[]}
        departments={[]}
        loading={false}
        onSelectComplaint={vi.fn()}
        categoryFilter=""
        onCategoryFilterChange={vi.fn()}
        severityFilter=""
        onSeverityFilterChange={vi.fn()}
        statusFilter=""
        onStatusFilterChange={vi.fn()}
        departmentFilter=""
        onDepartmentFilterChange={vi.fn()}
        dateHorizon="all"
        onDateHorizonChange={vi.fn()}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        onResetFilters={vi.fn()}
      />
    );
    expect(screen.getByText('No civic reports yet')).toBeInTheDocument();
    unmountQueue();

    // Render HotspotIntelligence empty state
    const { unmount: unmountHotspots } = render(
      <HotspotIntelligence
        hotspots={[]}
        allComplaints={[]}
        onSelectHotspot={vi.fn()}
        onNavigateToMap={vi.fn()}
        onSelectComplaint={vi.fn()}
      />
    );
    expect(screen.getByText('No active hotspot corridors identified')).toBeInTheDocument();
    unmountHotspots();
  });

  // 12. No demo data / reset functionality
  it('12. no demo data / reset functionality: verify no Reset Demo buttons or dummy controls exist in UI', async () => {
    render(
      <AuthProvider>
        <Sidebar
          currentRoute="/dashboard"
          onRouteChange={vi.fn()}
          onLogout={vi.fn()}
        />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Authority Portal')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Reset Demo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reset Demo Data/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Demo Dataset/i)).not.toBeInTheDocument();
  });

  // 13. Authority login flow in App: no "Access Restricted" flash
  it('13. authority login flow in App: never displays Access Restricted screen during login', async () => {
    window.location.hash = '';

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    vi.mocked(supabase.auth.signInWithPassword).mockImplementation(async () => {
      return {
        data: {
          session: {
            access_token: 'test-authority-token',
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'refresh-token',
            user: {
              id: 'officer-test-id',
              email: 'officer@municipal.gov',
              app_metadata: {},
              user_metadata: { full_name: 'Officer Raj' },
              aud: 'authenticated',
              created_at: '2026-01-01',
            },
          } as any,
          user: {
            id: 'officer-test-id',
            email: 'officer@municipal.gov',
          } as any,
        },
        error: null,
      };
    });

    globalThis.fetch = vi.fn().mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'officer-test-id',
            email: 'officer@municipal.gov',
            role: 'authority',
            full_name: 'Officer Raj',
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => [],
      };
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Authority Portal')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'officer@municipal.gov' },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: 'SecurePass123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    // During and after login, Access Restricted must never be rendered
    expect(screen.queryByText('Access Restricted')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Access Restricted')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Sign In/i })).not.toBeInTheDocument();
    });
  });
});
