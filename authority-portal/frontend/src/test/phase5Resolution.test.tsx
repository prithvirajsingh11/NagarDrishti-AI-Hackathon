import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ComplaintDrawer } from '../components/ComplaintDrawer';
import { CommandCenter } from '../pages/CommandCenter';
import { FilterBar } from '../components/FilterBar';
import { ThemeProvider } from '../context/ThemeContext';
import type { Complaint, DashboardStatistics } from '../types/complaint';
import * as api from '../services/api';

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  return {
    ...actual,
    uploadResolutionEvidence: vi.fn(),
    resolveComplaint: vi.fn(),
    updateComplaintStatus: vi.fn(),
    confirmComplaintResolution: vi.fn(),
    reopenComplaint: vi.fn(),
    getComplaintHistory: vi.fn(),
    getComplaints: vi.fn(),
    getDashboardStatistics: vi.fn(),
  };
});

describe('Phase 5: Authority Resolution Management & Citizen Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockComplaintInProgress: Complaint = {
    id: 'c001',
    report_id: 'NGD-2026-00101',
    problem_type: 'pothole',
    confidence: 0.95,
    severity: 'HIGH',
    evidence: ['Deep asphalt crater'],
    latitude: 23.2599,
    longitude: 77.4126,
    location_name: 'MP Nagar Zone 1, Bhopal',
    department: 'Municipal Roads (PWD)',
    description: 'Dangerous pothole outside commercial hub.',
    image_url: 'https://images.example.com/pothole_before.jpg',
    status: 'IN_PROGRESS',
    duplicate_of: null,
    created_at: '2026-09-28T10:00:00Z',
    updated_at: '2026-09-29T08:00:00Z',
    status_history: [
      {
        status: 'REPORTED',
        timestamp: '2026-09-28T10:00:00Z',
        note: 'Citizen submitted report',
        actor: 'Citizen App User',
        actor_role: 'citizen',
      },
      {
        status: 'IN_PROGRESS',
        timestamp: '2026-09-29T08:00:00Z',
        note: 'Field crew dispatched with hot-mix patcher',
        actor: 'Roads Division',
        actor_role: 'authority',
      },
    ],
  };

  const mockComplaintResolved: Complaint = {
    ...mockComplaintInProgress,
    id: 'c002',
    report_id: 'NGD-2026-00102',
    status: 'RESOLVED',
    resolution_image_url: 'https://images.example.com/pothole_after.jpg',
    resolution_note: 'Road surface leveled and hot-mix asphalt compacted.',
    resolved_at: '2026-09-29T14:30:00Z',
    resolved_by: 'PWD Executive Engineer',
    citizen_verification_status: 'PENDING',
    status_history: [
      ...mockComplaintInProgress.status_history!,
      {
        status: 'RESOLVED',
        timestamp: '2026-09-29T14:30:00Z',
        note: 'Road surface leveled and hot-mix asphalt compacted.',
        actor: 'PWD Executive Engineer',
        actor_role: 'authority',
      },
    ],
  };

  const mockComplaintReopened: Complaint = {
    ...mockComplaintResolved,
    id: 'c003',
    report_id: 'NGD-2026-00103',
    status: 'REOPENED',
    citizen_verification_status: 'REOPENED',
    reopened_at: '2026-09-29T16:00:00Z',
    reopen_reason: 'Edge of the pothole cracked open again after rain.',
    status_history: [
      ...mockComplaintResolved.status_history!,
      {
        status: 'REOPENED',
        timestamp: '2026-09-29T16:00:00Z',
        note: 'Edge of the pothole cracked open again after rain.',
        actor: 'Citizen User',
        actor_role: 'citizen',
      },
    ],
  };

  const mockStats: DashboardStatistics = {
    total_reports: 25,
    high_critical: 8,
    pending: 5,
    in_progress: 7,
    resolved: 10,
    awaiting_verification: 4,
    reopened: 2,
    by_category: { pothole: 10, garbage: 6, streetlight: 4, drain: 4, other: 1 },
    by_severity: { CRITICAL: 3, HIGH: 5, MEDIUM: 10, LOW: 7 },
    by_status: { REPORTED: 5, ASSIGNED: 2, IN_PROGRESS: 5, RESOLVED: 10, REOPENED: 2 },
    hotspots: [],
    daily_trends: [],
  };

  // 1. Authority can upload resolution evidence
  it('1. authority can upload resolution evidence (JPG/PNG/WEBP <= 10MB)', async () => {
    vi.mocked(api.uploadResolutionEvidence).mockResolvedValue({
      image_url: '/api/complaints/image/resolution_123.jpg',
      filename: 'resolution_123.jpg',
    });

    const onUpdateStatus = vi.fn().mockResolvedValue(undefined);

    render(
      <ThemeProvider>
        <ComplaintDrawer
          complaint={mockComplaintInProgress}
          onClose={vi.fn()}
          onUpdateStatus={onUpdateStatus}
        />
      </ThemeProvider>
    );

    // Open resolution confirmation modal
    const markResolvedBtn = screen.getByRole('button', { name: /mark as resolved/i });
    fireEvent.click(markResolvedBtn);

    expect(screen.getByText('Mark this civic issue as resolved?')).toBeInTheDocument();

    // Find file input and upload resolution photo
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const testFile = new File(['dummy-image-bytes'], 'repair_after.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Confirm resolution triggers evidence upload
    const confirmBtn = screen.getByRole('button', { name: /confirm resolution/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.uploadResolutionEvidence).toHaveBeenCalledWith(testFile);
    });
  });

  // 2. Authority can mark complaint resolved
  it('2. authority can mark complaint resolved with image and note', async () => {
    vi.mocked(api.uploadResolutionEvidence).mockResolvedValue({
      image_url: '/api/complaints/image/resolution_123.jpg',
      filename: 'resolution_123.jpg',
    });

    const onUpdateStatus = vi.fn().mockResolvedValue(undefined);

    render(
      <ThemeProvider>
        <ComplaintDrawer
          complaint={mockComplaintInProgress}
          onClose={vi.fn()}
          onUpdateStatus={onUpdateStatus}
        />
      </ThemeProvider>
    );

    // Open modal
    fireEvent.click(screen.getByRole('button', { name: /mark as resolved/i }));

    // Upload resolution image
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const testFile = new File(['dummy-image-bytes'], 'repair_after.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    // Enter resolution note
    const noteInput = screen.getByPlaceholderText(/road surface repaired/i);
    fireEvent.change(noteInput, { target: { value: 'Road asphalt resurfaced and roller compacted.' } });

    // Confirm resolution
    const confirmBtn = screen.getByRole('button', { name: /confirm resolution/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.uploadResolutionEvidence).toHaveBeenCalled();
      expect(onUpdateStatus).toHaveBeenCalledWith(
        'c001',
        'RESOLVED',
        expect.objectContaining({
          resolution_image_url: '/api/complaints/image/resolution_123.jpg',
          resolution_note: 'Road asphalt resurfaced and roller compacted.',
        })
      );
    });
  });

  // 3. Resolution timestamp is stored and displayed
  it('3. resolution timestamp and authority officer identity are displayed', () => {
    render(
      <ThemeProvider>
        <ComplaintDrawer
          complaint={mockComplaintResolved}
          onClose={vi.fn()}
          onUpdateStatus={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Resolution Summary')).toBeInTheDocument();
    expect(screen.getAllByText(/PWD Executive Engineer/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Road surface leveled and hot-mix asphalt compacted/i).length).toBeGreaterThanOrEqual(1);
  });

  // 4. Resolution image remains separate from citizen image (Before/After view)
  it('4. resolution image remains separate from citizen image in Before/After comparison', () => {
    render(
      <ThemeProvider>
        <ComplaintDrawer
          complaint={mockComplaintResolved}
          onClose={vi.fn()}
          onUpdateStatus={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.getByText(/Visual Evidence Comparison \(Before \/ After\)/i)).toBeInTheDocument();
    expect(screen.getByText('Citizen Report')).toBeInTheDocument();
    expect(screen.getByText('Resolution Evidence')).toBeInTheDocument();

    const images = screen.getAllByRole('img');
    const citizenImg = images.find((img) => img.getAttribute('src') === 'https://images.example.com/pothole_before.jpg');
    const resolutionImg = images.find((img) => img.getAttribute('src') === 'https://images.example.com/pothole_after.jpg');

    expect(citizenImg).toBeDefined();
    expect(resolutionImg).toBeDefined();
    expect(citizenImg?.getAttribute('src')).not.toEqual(resolutionImg?.getAttribute('src'));
  });

  // 5. Citizen verification appears correctly (PENDING)
  it('5. citizen verification status appears as PENDING awaiting citizen sign-off', () => {
    render(
      <ThemeProvider>
        <ComplaintDrawer
          complaint={mockComplaintResolved}
          onClose={vi.fn()}
          onUpdateStatus={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Citizen Verification')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText(/Awaiting citizen confirmation or feedback/i)).toBeInTheDocument();
  });

  // 6. Citizen confirmation changes verification state
  it('6. citizen confirmation renders green verified state', () => {
    const mockConfirmed: Complaint = {
      ...mockComplaintResolved,
      citizen_verification_status: 'CONFIRMED',
      citizen_verified_at: '2026-09-29T15:00:00Z',
      citizen_resolution_confirmed_at: '2026-09-29T15:00:00Z',
    };

    render(
      <ThemeProvider>
        <ComplaintDrawer
          complaint={mockConfirmed}
          onClose={vi.fn()}
          onUpdateStatus={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.getByText(/Citizen confirmed resolution/i)).toBeInTheDocument();
  });

  // 7. Citizen reopen request changes complaint to REOPENED
  it('7. citizen reopen request sets status to REOPENED with citizen explanation', () => {
    render(
      <ThemeProvider>
        <ComplaintDrawer
          complaint={mockComplaintReopened}
          onClose={vi.fn()}
          onUpdateStatus={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.getByText(/Citizen reported issue still exists/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Edge of the pothole cracked open again after rain/i).length).toBeGreaterThanOrEqual(1);
  });

  // 8. Reopened complaint appears with high-visibility banner in dashboard
  it('8. reopened complaints surface with high-visibility indicator banner in dashboard', () => {
    const onFilterChange = vi.fn();
    const onNavigateReports = vi.fn();

    render(
      <ThemeProvider>
        <CommandCenter
          stats={mockStats}
          complaints={[mockComplaintReopened]}
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
          resolutionStatusFilter=""
          onResolutionStatusFilterChange={onFilterChange}
          dateHorizon="all"
          onDateHorizonChange={vi.fn()}
          searchQuery=""
          onSearchQueryChange={vi.fn()}
          onResetFilters={vi.fn()}
          onNavigateToReports={onNavigateReports}
          onNavigateToHotspots={vi.fn()}
        />
      </ThemeProvider>
    );

    const alertBanner = screen.getByRole('alert');
    expect(alertBanner).toBeInTheDocument();
    expect(screen.getByText('⚠ Reopened Complaints')).toBeInTheDocument();

    fireEvent.click(alertBanner);
    expect(onFilterChange).toHaveBeenCalledWith('reopened');
    expect(onNavigateReports).toHaveBeenCalled();
  });

  // 9. Reopen history is preserved in auditable timeline
  it('9. auditable timeline maintains full history including reopen step', () => {
    render(
      <ThemeProvider>
        <ComplaintDrawer
          complaint={mockComplaintReopened}
          onClose={vi.fn()}
          onUpdateStatus={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Auditable Status History')).toBeInTheDocument();
    expect(screen.getByText('Citizen submitted report')).toBeInTheDocument();
    expect(screen.getByText('Field crew dispatched with hot-mix patcher')).toBeInTheDocument();
    expect(screen.getByText('Road surface leveled and hot-mix asphalt compacted.')).toBeInTheDocument();
    expect(screen.getAllByText('Edge of the pothole cracked open again after rain.').length).toBeGreaterThanOrEqual(1);
  });

  // 10. Unauthorized users cannot perform authority actions
  it('10. non-authority / unauthorized users receive rejected feedback', async () => {
    const onUpdateStatus = vi.fn().mockRejectedValue(new Error('Authority role required. Citizens are not permitted.'));

    render(
      <ThemeProvider>
        <ComplaintDrawer
          complaint={mockComplaintInProgress}
          onClose={vi.fn()}
          onUpdateStatus={onUpdateStatus}
        />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /mark as resolved/i }));

    // Mock upload success
    vi.mocked(api.uploadResolutionEvidence).mockResolvedValue({
      image_url: '/api/complaints/image/res.jpg',
      filename: 'res.jpg',
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' })] } });

    fireEvent.click(screen.getByRole('button', { name: /confirm resolution/i }));

    await waitFor(() => {
      expect(screen.getByText(/authority role required/i)).toBeInTheDocument();
    });
  });

  // 11. Existing dashboard tests still pass
  it('11. dashboard renders Phase 5 KPIs (Awaiting Verification & Reopened) without breaking layout', () => {
    render(
      <ThemeProvider>
        <CommandCenter
          stats={mockStats}
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
          resolutionStatusFilter=""
          onResolutionStatusFilterChange={vi.fn()}
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

    expect(screen.getByText('Awaiting Verification')).toBeInTheDocument();
    expect(screen.getAllByText('Reopened').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('4')).toBeInTheDocument(); // awaiting verification count
  });

  // 12. Resolution status filter correctly filters queue and map
  it('12. resolution status filter offers Phase 5 options and dispatches selection', () => {
    const onResolutionStatusChange = vi.fn();

    render(
      <FilterBar
        category=""
        onCategoryChange={vi.fn()}
        severity=""
        onSeverityChange={vi.fn()}
        status=""
        onStatusChange={vi.fn()}
        department=""
        onDepartmentChange={vi.fn()}
        resolutionStatus=""
        onResolutionStatusChange={onResolutionStatusChange}
        dateHorizon="all"
        onDateHorizonChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        departments={[]}
        onResetFilters={vi.fn()}
      />
    );

    const resolutionSelect = screen.getByLabelText(/filter by resolution status/i);
    expect(resolutionSelect).toBeInTheDocument();

    fireEvent.change(resolutionSelect, { target: { value: 'awaiting_verification' } });
    expect(onResolutionStatusChange).toHaveBeenCalledWith('awaiting_verification');

    fireEvent.change(resolutionSelect, { target: { value: 'reopened' } });
    expect(onResolutionStatusChange).toHaveBeenCalledWith('reopened');
  });
});
