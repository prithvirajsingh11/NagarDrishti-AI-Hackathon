import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CommandCenter } from '../pages/CommandCenter';
import { ComplaintDrawer } from '../components/ComplaintDrawer';
import { FilterBar } from '../components/FilterBar';
import * as api from '../services/api';
import type { Complaint, DashboardStatistics, Department } from '../types/complaint';

// Mock Leaflet
vi.mock('leaflet', () => {
  const mockMap = {
    setView: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    addLayer: vi.fn().mockReturnThis(),
    removeLayer: vi.fn().mockReturnThis(),
    invalidateSize: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
  };

  const mockLayer = {
    addTo: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis(),
    clearLayers: vi.fn().mockReturnThis(),
    addLayer: vi.fn().mockReturnThis(),
  };

  return {
    default: {
      map: vi.fn(() => mockMap),
      tileLayer: vi.fn(() => mockLayer),
      circleMarker: vi.fn(() => mockLayer),
      circle: vi.fn(() => mockLayer),
      marker: vi.fn(() => mockLayer),
      layerGroup: vi.fn(() => mockLayer),
      divIcon: vi.fn(() => ({})),
    },
  };
});

// Mock Recharts
vi.mock('recharts', async () => {
  const OriginalModule = await vi.importActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: '800px', height: '400px' }}>{children}</div>
    ),
  };
});

describe('Phase 8: Governance Reporting + Outcome Intelligence + Hackathon Readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockDepartments: Department[] = [
    { id: '1', name: 'Municipal Roads (PWD)', code: 'PWD', active: true },
    { id: '2', name: 'Solid Waste Management', code: 'SWM', active: true },
  ];

  const mockComplaints: Complaint[] = [
    {
      id: 'c001',
      report_id: 'NGD-2026-00001',
      problem_type: 'pothole',
      confidence: 0.95,
      severity: 'CRITICAL',
      evidence: ['Severe asphalt crater'],
      latitude: 28.6139,
      longitude: 77.2090,
      location_name: 'Connaught Place Outer Circle',
      department: 'Municipal Roads (PWD)',
      description: 'Major defect blocking traffic',
      image_url: 'https://example.com/pothole.jpg',
      status: 'ASSIGNED',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
      priority_score: 88.0,
      priority_level: 'CRITICAL',
      assigned_to: 'Engineer Sharma (Zonal Unit 1)',
      assigned_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      status_history: [
        {
          status: 'REPORTED',
          timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
          note: 'Citizen report intake',
          actor: 'Citizen',
        },
        {
          status: 'ASSIGNED',
          timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
          note: 'Assigned to Engineer Sharma',
          actor: 'Authority Dispatch',
        },
      ],
      internal_notes: [
        {
          id: 'note-1',
          complaint_id: 'c001',
          author: 'Executive Engineer',
          timestamp: new Date().toISOString(),
          note: 'Confidential: Asphalt batch scheduled for delivery tomorrow.',
        },
      ],
    },
    {
      id: 'c002',
      report_id: 'NGD-2026-00002',
      problem_type: 'garbage',
      confidence: 0.91,
      severity: 'HIGH',
      evidence: ['Accumulated waste'],
      latitude: 28.6500,
      longitude: 77.2100,
      location_name: 'Karol Bagh Market',
      department: 'Solid Waste Management',
      description: 'Overflowing dumpster',
      image_url: 'https://example.com/garbage.jpg',
      status: 'RESOLVED',
      created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
      resolved_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      resolved_by: 'Inspector Verma',
      priority_score: 65.0,
      priority_level: 'HIGH',
      citizen_verification_status: 'CONFIRMED',
      citizen_resolution_confirmed: true,
      assigned_to: 'Sanitation Crew 4',
    },
  ];

  const mockStats: DashboardStatistics = {
    total_reports: 2,
    high_critical: 2,
    pending: 0,
    in_progress: 1,
    resolved: 1,
    reopened: 0,
    awaiting_verification: 0,
    by_category: { pothole: 1, garbage: 1 },
    by_severity: { CRITICAL: 1, HIGH: 1, MEDIUM: 0, LOW: 0 },
    by_status: { ASSIGNED: 1, RESOLVED: 1 },
    hotspots: [],
    daily_trends: [
      { date: '2026-09-28', day_label: 'Mon', count: 1 },
      { date: '2026-09-29', day_label: 'Tue', count: 1 },
    ],
    priority_actions: [mockComplaints[0]],
    department_performance: [
      {
        department: 'Municipal Roads (PWD)',
        total: 1,
        assigned: 1,
        active_workload: 1,
        pending: 0,
        in_progress: 1,
        resolved: 0,
        reopened: 0,
        avg_resolution_hours: null, // Insufficient data
        resolution_rate: 0,
      },
      {
        department: 'Solid Waste Management',
        total: 1,
        assigned: 1,
        active_workload: 0,
        pending: 0,
        in_progress: 0,
        resolved: 1,
        reopened: 0,
        avg_resolution_hours: 96.0,
        resolution_rate: 100,
      },
    ],
    governance_outcomes: {
      total_complaints: 2,
      active_complaints: 1,
      resolved_complaints: 1,
      reopened_complaints: 0,
      resolution_rate_pct: 50.0,
      avg_response_hours: 24.0,
      avg_resolution_hours: 96.0,
      pending_citizen_verification: 0,
      escalated_cases: 1,
      resolution_rate_label: '50.0%',
      response_time_label: '24.0h avg response',
      resolution_time_label: '96.0h avg turnaround',
    },
    time_analytics: {
      received_over_time: [
        { date: '2026-09-28', day_label: 'Mon', count: 1 },
        { date: '2026-09-29', day_label: 'Tue', count: 1 },
      ],
      resolved_over_time: [
        { date: '2026-09-28', day_label: 'Mon', count: 0 },
        { date: '2026-09-29', day_label: 'Tue', count: 1 },
      ],
      reopened_over_time: [
        { date: '2026-09-28', day_label: 'Mon', count: 0 },
        { date: '2026-09-29', day_label: 'Tue', count: 0 },
      ],
      avg_response_hours: 24.0,
      avg_resolution_hours: 96.0,
    },
  };


  it('renders Governance Outcomes Summary with evidence-based metrics and trust indicator', () => {
    render(
      <CommandCenter
        stats={mockStats}
        complaints={mockComplaints}
        heatmapPoints={[]}
        departments={mockDepartments}
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
    );

    expect(screen.getByText(/Governance Outcomes & Performance Intelligence/i)).toBeInTheDocument();
    expect(screen.getByText('50% rate')).toBeInTheDocument(); // Resolution rate
    expect(screen.getByText('24h avg')).toBeInTheDocument(); // Avg response time
    expect(screen.getByText('96h avg')).toBeInTheDocument(); // Avg resolution turnaround
    expect(screen.getByText(/Data Integrity Standard/i)).toBeInTheDocument();
  });

  it('displays fallback indicators when measured sample size is zero instead of misleading 0s', () => {
    const statsWithNoData: DashboardStatistics = {
      ...mockStats,
      governance_outcomes: {
        total_complaints: 0,
        active_complaints: 0,
        resolved_complaints: 0,
        reopened_complaints: 0,
        resolution_rate_pct: null,
        avg_response_hours: null,
        avg_resolution_hours: null,
        pending_citizen_verification: 0,
        escalated_cases: 0,
        resolution_rate_label: 'Insufficient data',
        response_time_label: 'Insufficient data',
        resolution_time_label: 'Insufficient data',
      },
    };

    render(
      <CommandCenter
        stats={statsWithNoData}
        complaints={[]}
        heatmapPoints={[]}
        departments={mockDepartments}
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
    );

    const insufficientLabels = screen.getAllByText(/Insufficient|Unavailable|Awaiting|No resolved/i);
    expect(insufficientLabels.length).toBeGreaterThan(0);
  });

  it('triggers CSV download from FilterBar export button', async () => {
    const downloadSpy = vi.spyOn(api, 'downloadComplaintsCsv').mockResolvedValue(undefined);

    render(
      <FilterBar
        category="pothole"
        onCategoryChange={vi.fn()}
        severity="CRITICAL"
        onSeverityChange={vi.fn()}
        status=""
        onStatusChange={vi.fn()}
        department=""
        onDepartmentChange={vi.fn()}
        dateHorizon="all"
        onDateHorizonChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        departments={mockDepartments}
        onResetFilters={vi.fn()}
        onExportCsv={() => api.downloadComplaintsCsv({ problem_type: 'pothole', severity: 'CRITICAL' })}
      />
    );

    const exportBtn = screen.getByRole('button', { name: /Export CSV/i });
    expect(exportBtn).toBeInTheDocument();
    fireEvent.click(exportBtn);

    expect(downloadSpy).toHaveBeenCalledWith({ problem_type: 'pothole', severity: 'CRITICAL' });
  });

  it('renders Department Workload view with Assigned and Active Workload columns without arbitrary scores', () => {
    render(
      <CommandCenter
        stats={mockStats}
        complaints={mockComplaints}
        heatmapPoints={[]}
        departments={mockDepartments}
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
    );

    expect(screen.getByText(/Department Performance/i)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Assigned/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Active Workload/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Avg Turnaround/i })).toBeInTheDocument();

    // Verify unavailable fallback label is displayed for department without resolved cases
    expect(screen.getByText(/Unavailable \(no resolved cases\)/i)).toBeInTheDocument();
  });

  it('renders Case Detail Operational Summary in ComplaintDrawer and keeps internal notes confidential', () => {
    render(
      <ComplaintDrawer
        complaint={mockComplaints[0]}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        departments={mockDepartments}
      />
    );

    // Case Detail Operational Summary Card
    expect(screen.getByText(/Case Detail Operational Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Site: Connaught Place Outer Circle/i)).toBeInTheDocument();
    expect(screen.getByText(/Officer: Engineer Sharma \(Zonal Unit 1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Escalation Triggers:/i)).toBeInTheDocument();

    // Confidential Internal Notes Separation
    expect(screen.getByText(/Internal Authority Notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidential • Officers Only/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidential: Asphalt batch scheduled for delivery tomorrow./i)).toBeInTheDocument();
  });
});
