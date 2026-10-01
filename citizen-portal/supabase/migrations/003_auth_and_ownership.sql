-- NagarDrishti AI: Authentication, User Profiles, and Complaint Ownership Migration
-- Migration: 003_auth_and_ownership.sql

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'authority')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Auto-update updated_at for profiles
DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. AUTOMATIC PROFILE CREATION TRIGGER ON SIGNUP
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'citizen' -- Strictly 'citizen' role on public signup
    )
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if existing, then bind to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 3. COMPLAINTS OWNERSHIP (CITIZEN_ID)
-- ============================================================================
ALTER TABLE public.complaints
    ADD COLUMN IF NOT EXISTS citizen_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_complaints_citizen_id ON public.complaints(citizen_id);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Profiles: Users can read own profile" ON public.profiles;
CREATE POLICY "Profiles: Users can read own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Profiles: Users can update own profile" ON public.profiles;
CREATE POLICY "Profiles: Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id AND role = 'citizen'); -- Cannot escalate own role

DROP POLICY IF EXISTS "Profiles: Service role full access" ON public.profiles;
CREATE POLICY "Profiles: Service role full access"
    ON public.profiles FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Complaints Policies
DROP POLICY IF EXISTS "Complaints: Citizens can read own complaints" ON public.complaints;
CREATE POLICY "Complaints: Citizens can read own complaints"
    ON public.complaints FOR SELECT
    TO authenticated
    USING (auth.uid() = citizen_id);

DROP POLICY IF EXISTS "Complaints: Citizens can insert own complaints" ON public.complaints;
CREATE POLICY "Complaints: Citizens can insert own complaints"
    ON public.complaints FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = citizen_id);

DROP POLICY IF EXISTS "Complaints: Service role full access" ON public.complaints;
CREATE POLICY "Complaints: Service role full access"
    ON public.complaints FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
