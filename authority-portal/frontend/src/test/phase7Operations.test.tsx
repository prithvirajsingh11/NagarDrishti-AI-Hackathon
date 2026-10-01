import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CommandCenter } from '../pages/CommandCenter';
import { ComplaintQueue } from '../pages/ComplaintQueue';
import { ComplaintDrawer } from '../components/ComplaintDrawer';
import type { Complaint, Department } from '../types/complaint';

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

describe('Phase 7: Municipal Operations, Assignment & Escalation Intelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockDepartments: Department[] = [
    { id: '1', name: 'Municipal Roads (PWD)', code: 'PWD', email: 'roads@bhopal.gov.in', active: true },
    { id: '2', name: 'Solid Waste Management', code: 'SWM', email: 'swm@bhopal.gov.in', active: true },
  ];

  const mockComplaintWithOperations: Complaint = {
    id: 'c010',
    report_id: 'NGD-2026-P010',
    problem_type: 'pothole',
    confidence: 0.94,
    severity: 'HIGH',
    evidence: ['Deep crater on main carriage-way'],
    latitude: 23.2599,
    longitude: 77.4126,
    location_name: 'VIP Road, Bhopal',
    department: 'Municipal Roads (PWD)',
    description: 'Hazardous depression in outer lane',
    image_url: 'https://images.example.com/pothole10.jpg',
    status: 'ASSIGNED',
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    priority_score: 82.0,
    priority_level: 'HIGH',
    assigned_to: 'Officer B (Zonal Heavy Equipment Unit)',
    assigned_at: new Date().toISOString(),
    assignment_history: [
      {
        id: 'asg-1',
        previous_department: null,
        new_department: 'Municipal Roads (PWD)',
        previous_assignee: null,
        new_assignee: 'Officer A (Bhopal Rapid Patch Squad)',
        changed_by: 'Executive Engineer Phase 7',
        timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
        note: 'Immediate night milling and hot asphalt filling required.',
      },
      {
        id: 'asg-2',
        previous_department: 'Municipal Roads (PWD)',
        new_department: 'Municipal Roads (PWD)',
        previous_assignee: 'Officer A (Bhopal Rapid Patch Squad)',
        new_assignee: 'Officer B (Zonal Heavy Equipment Unit)',
        changed_by: 'Executive Engineer Phase 7',
        timestamp: new Date().toISOString(),
        note: 'Reassigned due to larger paver equipment requirement.',
      },
    ],
    internal_notes: [
      {
        id: 'note-1',
        complaint_id: 'c010',
        note: 'Material procurement pending for bitumen grade 60/70.',
        author: 'Executive Engineer Phase 7',
        author_role: 'authority',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'note-2',
        complaint_id: 'c010',
        note: 'Contractor contacted; equipment rolling at 22:30.',
        author: 'Executive Engineer Phase 7',
        author_role: 'authority',
        timestamp: new Date().toISOString(),
      },
    ],
    status_update_requests: [
      {
        id: 'req-open',
        complaint_id: 'NGD-2026-P010',
        citizen_message: 'Water logging increasing near storefront. Need update please.',
        state: 'OPEN',
        request_date: new Date(Date.now() - 7200000).toISOString(),
        citizen_notified: false,
      },
      {
        id: 'req-ack',
        complaint_id: 'NGD-2026-P010',
        citizen_message: 'Is crew arriving today?',
        state: 'ACKNOWLEDGED',
        request_date: new Date(Date.now() - 14400000).toISOString(),
        acknowledged_by: 'Executive Engineer Phase 7',
        response_note: 'Drainage jetting unit deployed; estimated clearance 45 mins.',
        citizen_notified: true,
      },
    ],
    status_history: [
      {
        status: 'REPORTED',
        timestamp: new Date(Date.now() - 4 * 86400000).toISOString(),
        note: 'Citizen submitted report',
        actor: 'Citizen User',
      },
      {
        status: 'ASSIGNED',
        timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
        note: 'Assigned to Municipal Roads (PWD) / Officer A',
        actor: 'Executive Engineer Phase 7',
      },
      {
        status: 'INTERNAL_NOTE',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        note: 'Internal note: Material procurement pending for bitumen grade 60/70.',
        actor: 'Executive Engineer Phase 7',
      },
      {
        status: 'STATUS_REQUEST_ACKNOWLEDGED',
        timestamp: new Date().toISOString(),
        note: 'Status update request acknowledged by Executive Engineer Phase 7',
        actor: 'Executive Engineer Phase 7',
      },
    ],
  };

  it('1. renders Case Assignment and displays non-overwriting audit history records', async () => {
    const handleAssign = vi.fn().mockResolvedValue(undefined);

    render(
      <ComplaintDrawer
        complaint={mockComplaintWithOperations}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onAssignComplaint={handleAssign}
        departments={mockDepartments}
      />
    );

    // Verify Case Assignment card is present
    expect(screen.getByText('Case Assignment & Officer Dispatch')).toBeInTheDocument();
    expect(screen.getByText('Officer B (Zonal Heavy Equipment Unit)')).toBeInTheDocument();

    // Verify Auditable Assignment History displays both historical records without overwriting
    expect(screen.getByText(/Assignment History \(2\)/)).toBeInTheDocument();
    expect(
      screen.getByText('Officer A (Bhopal Rapid Patch Squad) (Municipal Roads (PWD))')
    ).toBeInTheDocument();
    expect(
      screen.getByText('"Immediate night milling and hot asphalt filling required."')
    ).toBeInTheDocument();
    expect(
      screen.getByText('"Reassigned due to larger paver equipment requirement."')
    ).toBeInTheDocument();

    // Submit new assignment
    const officerInput = screen.getByPlaceholderText('e.g., Officer A (Bhopal Rapid Patch Squad)');
    const noteInput = screen.getByPlaceholderText(
      'e.g., Immediate night milling and hot asphalt filling required.'
    );
    fireEvent.change(officerInput, { target: { value: 'Officer C (Special Surface Squad)' } });
    fireEvent.change(noteInput, { target: { value: 'Third squad deployment note' } });

    const submitBtn = screen.getByRole('button', { name: /Reassign Case/i });
    fireEvent.click(submitBtn);

    expect(handleAssign).toHaveBeenCalledWith('c010', {
      department: 'Municipal Roads (PWD)',
      assigned_to: 'Officer C (Special Surface Squad)',
      note: 'Third squad deployment note',
    });
  });

  it('2. renders Confidential Internal Notes with privacy badges and submits new officer note', async () => {
    const handleAddNote = vi.fn().mockResolvedValue(undefined);

    render(
      <ComplaintDrawer
        complaint={mockComplaintWithOperations}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onAddInternalNote={handleAddNote}
        departments={mockDepartments}
      />
    );

    // Verify Confidential badge
    expect(screen.getByText('Internal Authority Notes')).toBeInTheDocument();
    expect(screen.getByText(/Confidential • Officers Only/i)).toBeInTheDocument();

    // Verify existing notes are rendered chronologically
    expect(
      screen.getByText('Material procurement pending for bitumen grade 60/70.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Contractor contacted; equipment rolling at 22:30.')
    ).toBeInTheDocument();

    // Add note
    const noteInput = screen.getByPlaceholderText(/Add confidential officer note/i);
    fireEvent.change(noteInput, { target: { value: 'Site inspection completed at 23:00.' } });

    const postBtn = screen.getByRole('button', { name: /Post Internal Note/i });
    fireEvent.click(postBtn);

    expect(handleAddNote).toHaveBeenCalledWith('c010', 'Site inspection completed at 23:00.');
  });

  it('3. displays Citizen Status Inquiries and acknowledges open inquiry with progress note', async () => {
    const handleAcknowledge = vi.fn().mockResolvedValue(undefined);

    render(
      <ComplaintDrawer
        complaint={mockComplaintWithOperations}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onAcknowledgeStatusRequest={handleAcknowledge}
        departments={mockDepartments}
      />
    );

    // Verify Citizen Inquiries section
    expect(screen.getByText('Citizen Status Inquiries')).toBeInTheDocument();
    expect(
      screen.getByText('"Water logging increasing near storefront. Need update please."')
    ).toBeInTheDocument();

    // Verify acknowledged note displayed
    expect(
      screen.getByText('"Drainage jetting unit deployed; estimated clearance 45 mins."')
    ).toBeInTheDocument();

    // Enter acknowledgement note and click Acknowledge Request
    const ackInput = screen.getByPlaceholderText(/Enter acknowledgment \/ progress update/i);
    fireEvent.change(ackInput, { target: { value: 'Jetting crew on-site clearing blockage.' } });

    const ackBtn = screen.getByRole('button', { name: /Acknowledge Request/i });
    fireEvent.click(ackBtn);

    expect(handleAcknowledge).toHaveBeenCalledWith(
      'c010',
      'req-open',
      'Jetting crew on-site clearing blockage.'
    );
  });

  it('4. renders Escalation Center in CommandCenter with explicit operational reasons and priority score', async () => {
    const mockSelectComplaint = vi.fn();

    render(
      <CommandCenter
        stats={null}
        complaints={[mockComplaintWithOperations]}
        heatmapPoints={[]}
        departments={mockDepartments}
        loading={false}
        onSelectComplaint={mockSelectComplaint}
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

    // Escalation Center section header
    expect(screen.getByText('Escalation Center')).toBeInTheDocument();
    expect(screen.getByText(/Active Escalations/i)).toBeInTheDocument();

    // Verify transparent reasons rendered
    expect(screen.getByText(/Escalation Triggers:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/High priority/i).length).toBeGreaterThan(0);

    // Click Triage button
    const triageBtn = screen.getByRole('button', { name: /Triage/i });
    fireEvent.click(triageBtn);
    expect(mockSelectComplaint).toHaveBeenCalledWith(mockComplaintWithOperations);
  });

  it('5. renders Assigned Officer in ComplaintQueue table under Department', () => {
    render(
      <ComplaintQueue
        complaints={[mockComplaintWithOperations]}
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
        dateHorizon="all"
        onDateHorizonChange={vi.fn()}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        onResetFilters={vi.fn()}
      />
    );

    // Verify Department name and Assigned Officer badge
    expect(screen.getAllByText('Municipal Roads (PWD)').length).toBeGreaterThan(0);
    expect(screen.getByText(/Officer B \(Zonal Heavy Equipment Unit\)/)).toBeInTheDocument();
  });
});
