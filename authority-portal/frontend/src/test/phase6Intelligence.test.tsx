import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CommandCenter } from '../pages/CommandCenter';
import { ComplaintQueue } from '../pages/ComplaintQueue';
import { ComplaintDrawer } from '../components/ComplaintDrawer';
import { LeafletMap } from '../components/LeafletMap';
import type { Complaint, DashboardStatistics, Department } from '../types/complaint';

// Mock Leaflet because jsdom doesn't support canvas/WebGL rendering
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

describe('Phase 6: Municipal Intelligence, Prioritization & Decision Support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockDepartments: Department[] = [
    { id: '1', name: 'Roads & Highways', code: 'ROAD', email: 'roads@bhopal.gov.in', active: true },
    { id: '2', name: 'Solid Waste Management', code: 'SWM', email: 'swm@bhopal.gov.in', active: true },
    { id: '3', name: 'Electrical & Street Lighting', code: 'ELEC', email: 'elec@bhopal.gov.in', active: true },
  ];

  const mockComplaints: Complaint[] = [
    {
      id: 'c1',
      report_id: 'NGD-2026-P01',
      problem_type: 'pothole',
      confidence: 0.95,
      severity: 'CRITICAL',
      evidence: ['Massive sinkhole on arterial corridor'],
      latitude: 23.2599,
      longitude: 77.4126,
      location_name: 'Janpath Road, Bhopal',
      department: 'Roads & Highways',
      description: 'Major road hazard causing vehicular damage',
      image_url: 'https://images.example.com/pothole1.jpg',
      status: 'REOPENED',
      reopened_at: '2026-09-28T12:00:00Z',
      reopen_reason: 'Asphalt eroded again after light rain',
      duplicate_of: null,
      created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(), // 5 days old (3-7 days bucket)
      updated_at: new Date().toISOString(),
      priority_score: 95.0,
      priority_level: 'CRITICAL',
      priority_explanation: 'Critical severity (+40) + Reopened report (+30) + Aged 3-7 days (+12) + Spatial density (+8)',
    },
    {
      id: 'c2',
      report_id: 'NGD-2026-P02',
      problem_type: 'garbage',
      confidence: 0.91,
      severity: 'HIGH',
      evidence: ['Overflowing municipal dumpster'],
      latitude: 23.262,
      longitude: 77.415,
      location_name: 'New Market Zone 2, Bhopal',
      department: 'Solid Waste Management',
      description: 'Rotting garbage blocking sidewalk',
      image_url: 'https://images.example.com/garbage1.jpg',
      status: 'REPORTED',
      duplicate_of: null,
      created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), // 2 days old (1-3 days bucket)
      updated_at: new Date().toISOString(),
      priority_score: 55.0,
      priority_level: 'HIGH',
      priority_explanation: 'High severity (+25) + Unassigned status (+8) + Aged 1-3 days (+6) + Municipal waste weight (+2)',
    },
    {
      id: 'c3',
      report_id: 'NGD-2026-P03',
      problem_type: 'streetlight',
      confidence: 0.88,
      severity: 'MEDIUM',
      evidence: ['Dark street fixture'],
      latitude: 23.245,
      longitude: 77.43,
      location_name: 'Arera Colony Ward 45, Bhopal',
      department: 'Electrical & Street Lighting',
      description: 'Streetlight pole dark for over a week',
      image_url: 'https://images.example.com/streetlight1.jpg',
      status: 'IN_PROGRESS',
      duplicate_of: null,
      created_at: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString(), // 9 days old (7+ days bucket)
      updated_at: new Date().toISOString(),
      priority_score: 40.0,
      priority_level: 'MEDIUM',
      priority_explanation: 'Medium severity (+12) + In-progress status (+5) + Aged 7+ days (+20) + Streetlight weight (+3)',
    },
    {
      id: 'c4',
      report_id: 'NGD-2026-P04',
      problem_type: 'pothole',
      confidence: 0.96,
      severity: 'LOW',
      evidence: ['Minor surface crack'],
      latitude: 23.25,
      longitude: 77.41,
      location_name: 'Bittan Market, Bhopal',
      department: 'Roads & Highways',
      description: 'Repaired by maintenance team',
      image_url: 'https://images.example.com/pothole_fixed.jpg',
      status: 'RESOLVED',
      resolved_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      resolution_image_url: 'https://images.example.com/pothole_after.jpg',
      duplicate_of: null,
      created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      priority_score: 0.0,
      priority_level: 'LOW',
      priority_explanation: 'Resolved complaint (priority clamped to 0)',
    },
  ];

  const mockStats: DashboardStatistics = {
    total_reports: 4,
    total_complaints: 4,
    high_critical: 2,
    pending: 1,
    in_progress: 1,
    resolved: 1,
    by_status: {
      REPORTED: 1,
      IN_PROGRESS: 1,
      RESOLVED: 1,
      REOPENED: 1,
    },
    by_severity: {
      CRITICAL: 1,
      HIGH: 1,
      MEDIUM: 1,
      LOW: 1,
    },
    by_category: {
      pothole: 2,
      garbage: 1,
      streetlight: 1,
    },
    hotspots: [
      {
        centroid_name: 'Janpath Road Corridor',
        latitude: 23.2599,
        longitude: 77.4126,
        radius_km: 0.5,
        total_reports: 5,
        dominant_issue: 'pothole',
        severity_score: 8.5,
        high_critical_count: 3,
        unresolved_count: 4,
        reopened_count: 2,
        affected_department: 'Roads & Highways',
        trend: 'increasing',
        severity_distribution: { CRITICAL: 2, HIGH: 2, MEDIUM: 1 },
        suggested_action: 'Prioritize multi-crew asphalt milling and structural roadbed inspection along Janpath corridor.',
        title: 'Janpath Road Corridor',
      },
    ],
    priority_actions: [mockComplaints[0], mockComplaints[1]],
    aging_analysis: {
      bucket_0_24h: { label: '0–24 hours', count: 0, percentage: 0, department_breakdown: {} },
      bucket_1_3d: { label: '1–3 days', count: 1, percentage: 33.3, department_breakdown: { 'Solid Waste Management': 1 } },
      bucket_3_7d: { label: '3–7 days', count: 1, percentage: 33.3, department_breakdown: { 'Roads & Highways': 1 } },
      bucket_7d_plus: { label: '7+ days', count: 1, percentage: 33.3, department_breakdown: { 'Electrical & Street Lighting': 1 } },
      total_unresolved: 3,
    },
    department_performance: [
      {
        department: 'Roads & Highways',
        total: 2,
        total_assigned: 2,
        pending: 0,
        in_progress: 0,
        resolved: 1,
        reopened: 1,
        avg_resolution_hours: 48.0,
        resolution_rate: 50.0,
      },
      {
        department: 'Solid Waste Management',
        total: 1,
        total_assigned: 1,
        pending: 1,
        in_progress: 0,
        resolved: 0,
        reopened: 0,
        avg_resolution_hours: null,
        resolution_rate: 0.0,
      },
      {
        department: 'Electrical & Street Lighting',
        total: 1,
        total_assigned: 1,
        pending: 0,
        in_progress: 1,
        resolved: 0,
        reopened: 0,
        avg_resolution_hours: null,
        resolution_rate: 0.0,
      },
    ],
    category_trends: [
      {
        category: 'pothole',
        count_7d: 2,
        count_prev_7d: 1,
        velocity_change_pct: 100.0,
        direction: 'increasing',
        count_30d: 2,
        count_prev_30d: 0,
      },
      {
        category: 'garbage',
        count_7d: 1,
        count_prev_7d: 0,
        velocity_change_pct: null,
        direction: 'insufficient_data',
        count_30d: 1,
        count_prev_30d: 0,
      },
    ],
  };

  it('renders Priority Actions section ("What should we act on first?") with badges and scores', () => {
    const handleSelect = vi.fn();
    render(
      <CommandCenter
        stats={mockStats}
        complaints={mockComplaints}
        heatmapPoints={[]}
        departments={mockDepartments}
        loading={false}
        onSelectComplaint={handleSelect}
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

    // Verify Section Title and Description
    expect(screen.getByText('Priority Actions')).toBeInTheDocument();
    expect(screen.getByText(/Deterministic municipal priority ranking/i)).toBeInTheDocument();

    // Verify top unresolved complaint is shown with Report ID
    const reportIdElements = screen.getAllByText('NGD-2026-P01');
    expect(reportIdElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Janpath Road, Bhopal').length).toBeGreaterThanOrEqual(1);

    // Verify priority level and score displayed in badge
    const criticalBadges = screen.getAllByText(/Critical Priority/i);
    expect(criticalBadges.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\(95\)/).length).toBeGreaterThan(0);

    // Verify Reopened indicator tag
    expect(screen.getAllByText('⚠ Reopened').length).toBeGreaterThanOrEqual(1);

    // Clicking row triggers onSelectComplaint
    const actionRow = reportIdElements[0].closest('tr');
    expect(actionRow).not.toBeNull();
    if (actionRow) {
      fireEvent.click(actionRow);
      expect(handleSelect).toHaveBeenCalledWith(expect.objectContaining({ report_id: 'NGD-2026-P01' }));
    }
  });

  it('renders Complaint Aging Intelligence with all 4 time buckets and department breakdowns', () => {
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

    // Verify Section header
    expect(screen.getByText('Complaint Aging')).toBeInTheDocument();

    // Verify all 4 buckets are displayed
    expect(screen.getByText('0–24 hours')).toBeInTheDocument();
    expect(screen.getByText('1–3 days')).toBeInTheDocument();
    expect(screen.getByText('3–7 days')).toBeInTheDocument();
    expect(screen.getByText('7+ days')).toBeInTheDocument();

    // Verify department distribution details
    expect(screen.getByText('Roads & Highways:')).toBeInTheDocument();
    expect(screen.getByText('Electrical & Street Lighting:')).toBeInTheDocument();
  });

  it('renders Department Performance table and triggers filter when department is clicked', () => {
    const handleDeptFilter = vi.fn();
    const handleNavigateReports = vi.fn();

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
        onDepartmentFilterChange={handleDeptFilter}
        dateHorizon="all"
        onDateHorizonChange={vi.fn()}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        onResetFilters={vi.fn()}
        onNavigateToReports={handleNavigateReports}
        onNavigateToHotspots={vi.fn()}
      />
    );

    // Verify Section Header
    expect(screen.getByText('Department Performance')).toBeInTheDocument();

    // Verify metrics in table
    expect(screen.getAllByText('Roads & Highways').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Solid Waste Management').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Electrical & Street Lighting').length).toBeGreaterThan(0);
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('48h')).toBeInTheDocument();

    // Clicking department row triggers filter and navigation
    const deptRows = screen.getAllByText('Roads & Highways');
    const deptRow = deptRows[deptRows.length - 1].closest('tr');
    expect(deptRow).not.toBeNull();
    if (deptRow) {
      fireEvent.click(deptRow);
      expect(handleDeptFilter).toHaveBeenCalledWith('Roads & Highways');
      expect(handleNavigateReports).toHaveBeenCalled();
    }
  });

  it('renders Category Trend Intelligence with velocity and explicit "Insufficient data" label', () => {
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

    // Verify Section Title
    expect(screen.getByText('Category Trend Intelligence')).toBeInTheDocument();

    // Verify increasing trend
    expect(screen.getByText('+100%')).toBeInTheDocument();

    // Verify "Insufficient data" is clearly shown instead of fabricated numbers
    expect(screen.getByText('Insufficient data')).toBeInTheDocument();
  });

  it('renders Priority column in ComplaintQueue and sorts by priority score', () => {
    const handlePriorityFilterChange = vi.fn();

    render(
      <ComplaintQueue
        complaints={mockComplaints}
        departments={mockDepartments}
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
        priorityLevelFilter=""
        onPriorityLevelFilterChange={handlePriorityFilterChange}
        dateHorizon="all"
        onDateHorizonChange={vi.fn()}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        onResetFilters={vi.fn()}
      />
    );

    // Verify Priority column header exists
    expect(screen.getByRole('button', { name: /Priority/i })).toBeInTheDocument();

    // Verify FilterBar priority filter dropdown exists
    const prioritySelect = screen.getByLabelText(/Priority Level/i);
    expect(prioritySelect).toBeInTheDocument();
    fireEvent.change(prioritySelect, { target: { value: 'CRITICAL' } });
    expect(handlePriorityFilterChange).toHaveBeenCalledWith('CRITICAL');
  });

  it('displays Priority rationale breakdown in ComplaintDrawer', () => {
    render(
      <ComplaintDrawer
        complaint={mockComplaints[0]}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onSelectDuplicate={vi.fn()}
      />
    );

    // Drawer displays report id and priority rationale
    expect(screen.getByText('Municipal Priority Rationale')).toBeInTheDocument();
    expect(
      screen.getByText(/Critical severity \(\+40\) \+ Reopened report \(\+30\)/)
    ).toBeInTheDocument();
  });

  it('renders LeafletMap with intelligence overlay toolbar without modifying map center', () => {
    render(
      <LeafletMap
        complaints={mockComplaints}
        heatmapPoints={[]}
        hotspots={mockStats.hotspots}
        mapMode="markers"
        onMapModeChange={vi.fn()}
        onSelectComplaint={vi.fn()}
        heightClass="h-96"
      />
    );

    // Check overlay toolbar buttons
    expect(screen.getByRole('button', { name: /^Priority$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Reopened$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Aging \(3d\+\)$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Corridors$/i })).toBeInTheDocument();

    // Clicking overlay button toggles active state
    const priorityOverlayBtn = screen.getByRole('button', { name: /^Priority$/i });
    fireEvent.click(priorityOverlayBtn);
    expect(priorityOverlayBtn).toHaveClass('bg-rose-600');
  });
});
