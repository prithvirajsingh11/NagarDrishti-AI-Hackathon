import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://otjbonkovzciglttxfzz.supabase.co';

const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90amJvbmtvdnpjaWdsdHR4Znp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0ODEyMzYsImV4cCI6MjEwNjA1NzIzNn0.tGHgrcd7SjycoQHBVBV_ICeL6g5EmnTWjrTgye8HsrE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
