import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LeafletMap } from '../components/LeafletMap';
import { ComplaintDrawer } from '../components/ComplaintDrawer';
import type { Complaint, Department } from '../types/complaint';

// Mock Leaflet
vi.mock('leaflet', () => {
  const mockMap = {
    setView: vi.fn().mockReturnThis(),
    flyTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    addLayer: vi.fn().mockReturnThis(),
    removeLayer: vi.fn().mockReturnThis(),
    invalidateSize: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    closePopup: vi.fn(),
  };

  const mockLayer = {
    addTo: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis(),
    bindTooltip: vi.fn().mockReturnThis(),
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

describe('Phase 9: Production Hardening + Municipal Operations Reliability', () => {
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

  const malformedComplaints: Complaint[] = [
    {
      id: 'c-normal-1',
      report_id: 'NGD-2026-DELHI',
      problem_type: 'pothole',
      confidence: 0.94,
      severity: 'CRITICAL',
      evidence: ['Crater'],
      latitude: 28.6139, // New Delhi
      longitude: 77.2090,
      location_name: 'Connaught Place, New Delhi',
      department: 'Municipal Roads (PWD)',
      description: 'Major road defect',
      image_url: 'https://example.com/delhi.jpg',
      status: 'ASSIGNED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      priority_score: 85.0,
      priority_level: 'CRITICAL',
    },
    {
      id: 'c-normal-2',
      report_id: 'NGD-2026-BHOPAL',
      problem_type: 'drain',
      confidence: 0.90,
      severity: 'HIGH',
      evidence: ['Drain block'],
      latitude: 23.2599, // Bhopal
      longitude: 77.4126,
      location_name: 'MP Nagar, Bhopal',
      department: 'Solid Waste Management',
      description: 'Blocked drain',
      image_url: 'https://example.com/bhopal.jpg',
      status: 'REPORTED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      priority_score: 62.0,
      priority_level: 'HIGH',
    },
    {
      id: 'c-malformed-1',
      report_id: 'NGD-2026-MALFORMED-1',
      problem_type: 'pothole',
      confidence: 0.8,
      severity: 'LOW',
      evidence: [],
      latitude: null as any,
      longitude: null as any,
      location_name: 'Unknown GPS Location',
      department: 'Municipal Roads (PWD)',
      description: 'GPS signal lost',
      image_url: '',
      status: 'REPORTED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c-malformed-2',
      report_id: 'NGD-2026-MALFORMED-2',
      problem_type: 'pothole',
      confidence: 0.8,
      severity: 'LOW',
      evidence: [],
      latitude: NaN,
      longitude: NaN,
      location_name: 'Corrupt Coords',
      department: 'Municipal Roads (PWD)',
      description: 'NaN coordinates',
      image_url: '',
      status: 'REPORTED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c-malformed-3',
      report_id: 'NGD-2026-MALFORMED-3',
      problem_type: 'pothole',
      confidence: 0.8,
      severity: 'LOW',
      evidence: [],
      latitude: 999.0, // Out of bounds
      longitude: -999.0,
      location_name: 'Out of bounds',
      department: 'Municipal Roads (PWD)',
      description: 'Bad bounds',
      image_url: '',
      status: 'REPORTED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  it('1. LeafletMap renders India-wide coordinates and safely ignores malformed/missing coordinates without crashing', () => {
    expect(() => {
      render(
        <LeafletMap
          complaints={malformedComplaints}
          heatmapPoints={[]}
          mapMode="markers"
          onMapModeChange={vi.fn()}
          onSelectComplaint={vi.fn()}
        />
      );
    }).not.toThrow();

    expect(screen.getByRole('button', { name: /Normal/i })).toBeInTheDocument();
  });

  it('2. LeafletMap clustering mode handles malformed coordinates safely', () => {
    expect(() => {
      render(
        <LeafletMap
          complaints={malformedComplaints}
          heatmapPoints={[]}
          mapMode="clusters"
          onMapModeChange={vi.fn()}
          onSelectComplaint={vi.fn()}
        />
      );
    }).not.toThrow();
  });

  it('3. LeafletMap heatmap mode handles malformed coordinates safely', () => {
    const malformedHeatmap = [
      { latitude: 28.6139, longitude: 77.2090, weight: 1.0, problem_type: 'pothole', severity: 'CRITICAL', report_id: 'R1' },
      { latitude: NaN, longitude: NaN, weight: 0.5, problem_type: 'drain', severity: 'LOW', report_id: 'R2' },
      { latitude: 999.0, longitude: 77.0, weight: 0.5, problem_type: 'garbage', severity: 'MEDIUM', report_id: 'R3' },
    ];

    expect(() => {
      render(
        <LeafletMap
          complaints={[]}
          heatmapPoints={malformedHeatmap}
          mapMode="heatmap"
          onMapModeChange={vi.fn()}
          onSelectComplaint={vi.fn()}
        />
      );
    }).not.toThrow();
  });

  it('4. ComplaintDrawer mutation safety: displays processing state and handles mutation failure cleanly', async () => {
    const mockFailAssign = vi.fn().mockRejectedValue(new Error('Network timeout during assignment'));

    render(
      <ComplaintDrawer
        complaint={{
          ...malformedComplaints[0],
          assigned_to: 'Officer Verma',
        }}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        onAssignComplaint={mockFailAssign}
        departments={mockDepartments}
      />
    );

    // Verify Reassign button exists and is clickable
    const assignBtn = screen.getByRole('button', { name: /Reassign Case/i });
    expect(assignBtn).toBeInTheDocument();

    // Trigger assignment
    fireEvent.click(assignBtn);

    // Mutation failure shows error message
    const errorBanner = await screen.findByText(/Network timeout during assignment/i);
    expect(errorBanner).toBeInTheDocument();
  });

  it('5. Internal notes are strictly separated with confidentiality indicator and privacy badge', () => {
    const complaintWithNote: Complaint = {
      ...malformedComplaints[0],
      internal_notes: [
        {
          id: 'note-secret-1',
          complaint_id: malformedComplaints[0].id,
          author: 'Zonal Chief',
          timestamp: new Date().toISOString(),
          note: 'Confidential: Equipment vendor contract renewal pending.',
        },
      ],
    };

    render(
      <ComplaintDrawer
        complaint={complaintWithNote}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        departments={mockDepartments}
      />
    );

    expect(screen.getByText(/Internal Authority Notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidential • Officers Only/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidential: Equipment vendor contract renewal pending./i)).toBeInTheDocument();
  });
});
