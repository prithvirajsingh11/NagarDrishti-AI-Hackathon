-- NagarDrishti AI: Phase 5 - Citizen Resolution & Complaint Tracking
-- Migration: 004_phase5_resolution_and_tracking.sql

-- ============================================================================
-- 1. EXTEND COMPLAINTS TABLE WITH RESOLUTION & AUDIT FIELDS
-- ============================================================================
ALTER TABLE public.complaints
    ADD COLUMN IF NOT EXISTS resolution_image_url TEXT,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS citizen_resolution_confirmed BOOLEAN DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS citizen_resolution_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS citizen_reopened BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS citizen_reopened_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reopen_reason TEXT;

-- Update status check constraint to include 'REOPENED'
ALTER TABLE public.complaints
    DROP CONSTRAINT IF EXISTS complaints_status_check;

ALTER TABLE public.complaints
    ADD CONSTRAINT complaints_status_check
    CHECK (status IN ('REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REOPENED'));

-- Index on resolved_at and citizen_reopened for analytics and status tracking
CREATE INDEX IF NOT EXISTS idx_complaints_resolved_at ON public.complaints(resolved_at);
CREATE INDEX IF NOT EXISTS idx_complaints_citizen_reopened ON public.complaints(citizen_reopened);

-- ============================================================================
-- 2. AUDITABLE COMPLAINT STATUS HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_by_role TEXT NOT NULL DEFAULT 'citizen',
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_complaint_id ON public.complaint_status_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_status_history_created_at ON public.complaint_status_history(created_at ASC);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;

-- Citizens can only view status history for complaints they own
DROP POLICY IF EXISTS "Status History: Citizens can read history of own complaints" ON public.complaint_status_history;
CREATE POLICY "Status History: Citizens can read history of own complaints"
    ON public.complaint_status_history FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_status_history.complaint_id
              AND c.citizen_id = auth.uid()
        )
    );

-- Backend service role has complete access
DROP POLICY IF EXISTS "Status History: Service role full access" ON public.complaint_status_history;
CREATE POLICY "Status History: Service role full access"
    ON public.complaint_status_history FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
