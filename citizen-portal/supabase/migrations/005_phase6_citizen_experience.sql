-- NagarDrishti AI: Phase 6 - Citizen Experience, Transparency & Civic Intelligence
-- Migration: 005_phase6_citizen_experience.sql

-- ============================================================================
-- 1. CITIZEN NOTIFICATIONS TABLE (LIGHTWEIGHT, REAL-EVENT DRIVEN)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.citizen_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citizen_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    report_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REOPENED', 'CONFIRMED')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_citizen_id ON public.citizen_notifications(citizen_id);
CREATE INDEX IF NOT EXISTS idx_notifications_complaint_id ON public.citizen_notifications(complaint_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.citizen_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.citizen_notifications(citizen_id, is_read);

-- ============================================================================
-- 2. ROW LEVEL SECURITY (RLS) POLICIES FOR NOTIFICATIONS
-- ============================================================================
ALTER TABLE public.citizen_notifications ENABLE ROW LEVEL SECURITY;

-- Citizens can only view their own notifications
DROP POLICY IF EXISTS "Notifications: Citizens can read own notifications" ON public.citizen_notifications;
CREATE POLICY "Notifications: Citizens can read own notifications"
    ON public.citizen_notifications FOR SELECT
    TO authenticated
    USING (auth.uid() = citizen_id);

-- Citizens can update own notification read state
DROP POLICY IF EXISTS "Notifications: Citizens can update own notifications" ON public.citizen_notifications;
CREATE POLICY "Notifications: Citizens can update own notifications"
    ON public.citizen_notifications FOR UPDATE
    TO authenticated
    USING (auth.uid() = citizen_id)
    WITH CHECK (auth.uid() = citizen_id);

-- Service role full access for backend event emission
DROP POLICY IF EXISTS "Notifications: Service role full access" ON public.citizen_notifications;
CREATE POLICY "Notifications: Service role full access"
    ON public.citizen_notifications FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- 3. ENSURE STATUS HISTORY RLS AND POLICIES
-- ============================================================================
-- Ensure status history allows reading if not already defined
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'complaint_status_history'
    ) THEN
        CREATE TABLE public.complaint_status_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
            previous_status TEXT,
            new_status TEXT NOT NULL,
            changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            changed_by_role TEXT NOT NULL DEFAULT 'citizen',
            note TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX idx_status_history_complaint_id ON public.complaint_status_history(complaint_id);
        CREATE INDEX idx_status_history_created_at ON public.complaint_status_history(created_at ASC);
        ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;
