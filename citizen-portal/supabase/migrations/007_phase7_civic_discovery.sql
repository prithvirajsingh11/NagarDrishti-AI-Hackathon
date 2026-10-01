-- NagarDrishti AI: Phase 7 - Civic Discovery & Smart Follow-Up
-- Migration: 007_phase7_civic_discovery.sql

-- ============================================================================
-- 1. CITIZEN STATUS UPDATE REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.complaint_status_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    report_id TEXT NOT NULL,
    citizen_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    problem_type TEXT NOT NULL,
    location_name TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWED', 'RESPONDED', 'DISMISSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance and quick authority lookup
CREATE INDEX IF NOT EXISTS idx_status_requests_citizen_id ON public.complaint_status_requests(citizen_id);
CREATE INDEX IF NOT EXISTS idx_status_requests_complaint_id ON public.complaint_status_requests(complaint_id);
CREATE INDEX IF NOT EXISTS idx_status_requests_created_at ON public.complaint_status_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_requests_status ON public.complaint_status_requests(status);

-- ============================================================================
-- 2. ROW LEVEL SECURITY (RLS) FOR STATUS REQUESTS
-- ============================================================================
ALTER TABLE public.complaint_status_requests ENABLE ROW LEVEL SECURITY;

-- Citizens can only view their own status update requests
DROP POLICY IF EXISTS "StatusRequests: Citizens can view own requests" ON public.complaint_status_requests;
CREATE POLICY "StatusRequests: Citizens can view own requests"
    ON public.complaint_status_requests FOR SELECT
    TO authenticated
    USING (auth.uid() = citizen_id);

-- Citizens can only insert their own status update requests
DROP POLICY IF EXISTS "StatusRequests: Citizens can insert own requests" ON public.complaint_status_requests;
CREATE POLICY "StatusRequests: Citizens can insert own requests"
    ON public.complaint_status_requests FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = citizen_id);

-- Service role full access for backend processing and authority review
DROP POLICY IF EXISTS "StatusRequests: Service role full access" ON public.complaint_status_requests;
CREATE POLICY "StatusRequests: Service role full access"
    ON public.complaint_status_requests FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 3. EXPAND CITIZEN NOTIFICATION EVENT TYPES
-- ============================================================================
DO $$
BEGIN
    ALTER TABLE public.citizen_notifications DROP CONSTRAINT IF EXISTS citizen_notifications_event_type_check;
    ALTER TABLE public.citizen_notifications ADD CONSTRAINT citizen_notifications_event_type_check 
        CHECK (event_type IN ('REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REOPENED', 'CONFIRMED', 'STATUS_UPDATE_REQUESTED'));
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;
