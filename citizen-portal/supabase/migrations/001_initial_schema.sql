-- NagarDrishti AI: Initial Database Schema
-- Migration: 001_initial_schema.sql

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. DEPARTMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial departments
INSERT INTO departments (name, category, is_active)
VALUES
    ('Municipal Roads', 'pothole', true),
    ('Sanitation', 'garbage', true),
    ('Electrical / Municipal Lighting', 'streetlight', true),
    ('Drainage / Sanitation', 'drain', true),
    ('Manual Review', 'other', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 2. COMPLAINTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL UNIQUE,
    problem_type TEXT NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    severity TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location_name TEXT NOT NULL,
    department TEXT NOT NULL,
    description TEXT DEFAULT '',
    image_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'REPORTED' CHECK (status IN ('REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED')),
    duplicate_of TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_complaints_report_id ON complaints(report_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_problem_type ON complaints(problem_type);
CREATE INDEX IF NOT EXISTS idx_complaints_severity ON complaints(severity);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_location ON complaints(latitude, longitude);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_complaints_updated_at ON complaints;
CREATE TRIGGER trigger_complaints_updated_at
    BEFORE UPDATE ON complaints
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. STORAGE BUCKET REGISTRATION (Supabase Storage - Private Bucket)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('complaint-images', 'complaint-images', false)
ON CONFLICT (id) DO UPDATE SET public = false;

