import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { API_BASE, SERVER_ORIGIN, resolveImageUrl } from '../services/api';
import { ComplaintDrawer } from '../components/ComplaintDrawer';
import type { Complaint, Department } from '../types/complaint';

describe('Phase 10: Final Cross-Repo Integration & Release Validation', () => {
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

  const testComplaint: Complaint = {
    id: 'c-cross-101',
    report_id: 'NGD-2026-BHOPAL-101',
    problem_type: 'pothole',
    confidence: 0.96,
    severity: 'HIGH',
    evidence: ['Severe asphalt crater', 'Sub-base erosion'],
    latitude: 23.2599,
    longitude: 77.4126,
    location_name: 'MP Nagar Zone 1, Bhopal',
    department: 'Municipal Roads (PWD)',
    assigned_to: 'Officer Verma (Rapid Response)',
    description: 'Road surface failed causing vehicle damage',
    image_url: 'https://example.com/crater.jpg',
    status: 'REOPENED',
    created_at: '2026-03-28T10:00:00Z',
    updated_at: '2026-03-29T14:30:00Z',
    resolved_at: '2026-03-29T12:00:00Z',
    citizen_reopened: true,
    reopen_reason: 'Patch washed away during morning rain',
    citizen_verification_status: 'REOPENED',
    priority_score: 88.5,
    priority_level: 'CRITICAL',
    status_history: [
      {
        status: 'REPORTED',
        timestamp: '2026-03-28T10:00:00Z',
        note: 'Reported by citizen with GPS location',
        actor: 'Citizen',
        actor_role: 'citizen',
      },
      {
        status: 'ASSIGNED',
        timestamp: '2026-03-28T11:00:00Z',
        note: 'Assigned to Municipal Roads (PWD)',
        actor: 'Authority Dispatcher',
        actor_role: 'authority',
      },
      {
        status: 'RESOLVED',
        timestamp: '2026-03-29T12:00:00Z',
        note: 'Repaired by squad',
        actor: 'Officer Verma',
        actor_role: 'authority',
      },
      {
        status: 'REOPENED',
        timestamp: '2026-03-29T14:30:00Z',
        note: 'Patch washed away during morning rain',
        actor: 'Citizen',
        actor_role: 'citizen',
      },
    ],
    status_update_requests: [
      {
        id: 'sur-101',
        complaint_id: 'c-cross-101',
        citizen_message: 'Has the repair team been dispatched yet?',
        state: 'OPEN',
        requested_at: '2026-03-28T10:30:00Z',
      },
    ],
    internal_notes: [
      {
        id: 'note-secret-101',
        complaint_id: 'c-cross-101',
        author: 'Chief Engineer',
        timestamp: '2026-03-28T10:45:00Z',
        note: 'Contractor liability under DLP (Defect Liability Period).',
      },
    ],
  };

  it('1. API_BASE and resolveImageUrl correctly format production endpoints without duplicate /api', () => {
    expect(API_BASE).toBeTruthy();
    expect(API_BASE.endsWith('/api')).toBe(true);

    // External URLs preserved
    expect(resolveImageUrl('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg');
    expect(resolveImageUrl('http://example.com/photo.jpg')).toBe('http://example.com/photo.jpg');
    expect(resolveImageUrl('blob:http://localhost/123')).toBe('blob:http://localhost/123');
    expect(resolveImageUrl('data:image/png;base64,...')).toBe('data:image/png;base64,...');

    // Relative URLs prefixed with server origin or preserved as path
    const relativeResolved = resolveImageUrl('/storage/resolution_123.jpg');
    if (SERVER_ORIGIN) {
      expect(relativeResolved).toBe(`${SERVER_ORIGIN}/storage/resolution_123.jpg`);
    } else {
      expect(relativeResolved).toBe('/storage/resolution_123.jpg');
    }
  });

  it('2. ComplaintDrawer presents cross-repo verified state: Reopened badge, reason, timeline, and assignment', () => {
    render(
      <ComplaintDrawer
        complaint={testComplaint}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        departments={mockDepartments}
      />
    );

    // Report ID
    expect(screen.getAllByText(/NGD-2026-BHOPAL-101/i).length).toBeGreaterThanOrEqual(1);

    // Reopened indicator
    expect(screen.getByText(/Citizen reported that this issue is still unresolved/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Patch washed away during morning rain/i).length).toBeGreaterThanOrEqual(1);

    // Assigned officer
    expect(screen.getAllByText(/Officer Verma \(Rapid Response\)/i).length).toBeGreaterThanOrEqual(1);

    // Timeline entries
    expect(screen.getByText(/Repaired by squad/i)).toBeInTheDocument();
  });

  it('3. Internal notes remain isolated with confidential markings in authority view', () => {
    render(
      <ComplaintDrawer
        complaint={testComplaint}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        departments={mockDepartments}
      />
    );

    expect(screen.getByText(/Internal Authority Notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidential • Officers Only/i)).toBeInTheDocument();
    expect(screen.getByText(/Contractor liability under DLP/i)).toBeInTheDocument();
  });

  it('4. Citizen status requests queue renders with citizen inquiry and acknowledge option', () => {
    render(
      <ComplaintDrawer
        complaint={testComplaint}
        onClose={vi.fn()}
        onUpdateStatus={vi.fn()}
        departments={mockDepartments}
      />
    );

    expect(screen.getByText(/Citizen Status Inquiries/i)).toBeInTheDocument();
    expect(screen.getByText(/Has the repair team been dispatched yet\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Acknowledge Request/i })).toBeInTheDocument();
  });
});
