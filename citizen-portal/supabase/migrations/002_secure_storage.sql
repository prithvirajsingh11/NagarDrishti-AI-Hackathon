-- NagarDrishti AI: Secure Storage Migration
-- Migration: 002_secure_storage.sql

-- 1. Ensure complaint-images bucket is PRIVATE
UPDATE storage.buckets
SET public = false
WHERE id = 'complaint-images';

-- 2. Drop any previous public select policy
DROP POLICY IF EXISTS "Public Access Complaint Images" ON storage.objects;

-- 3. Controlled Service Role Policy: Only backend service role key can read/write directly
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Service Role Storage Management'
    ) THEN
        CREATE POLICY "Service Role Storage Management"
        ON storage.objects FOR ALL
        TO service_role
        USING (bucket_id = 'complaint-images')
        WITH CHECK (bucket_id = 'complaint-images');
    END IF;
END $$;
