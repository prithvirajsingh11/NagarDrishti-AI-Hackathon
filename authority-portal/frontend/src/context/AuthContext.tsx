import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { getAuthUserProfile, registerSessionExpiryHandler } from '../services/api';

export interface AuthorityUser {
  id: string;
  email: string;
  role: 'authority' | 'citizen' | string;
  fullName: string;
}

interface AuthContextType {
  user: AuthorityUser | null;
  session: Session | null;
  token: string | null;
  loading: boolean;
  isAuthority: boolean;
  login: (credentials: { email: string; password: string }) => Promise<{ success: boolean; error?: string; isAuthority?: boolean }>;
  logout: () => Promise<void>;
  verifyServerRole: (sess?: Session | null) => Promise<AuthorityUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthorityUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Verifies the user's role against the trusted backend and Supabase profiles table
  const verifyServerRole = useCallback(async (activeSession?: Session | null): Promise<AuthorityUser | null> => {
    const currentSession = activeSession ?? (await supabase.auth.getSession()).data.session;
    if (!currentSession || !currentSession.user) {
      return null;
    }

    const authUser: User = currentSession.user;
    const email = authUser.email || '';
    
    // Check initial role claims directly from session metadata (app_metadata takes precedence, then user_metadata)
    const metadataRole = authUser.app_metadata?.role || authUser.user_metadata?.role;
    let role = metadataRole || 'citizen';
    let fullName = authUser.user_metadata?.full_name || email.split('@')[0] || 'Authority Officer';

    // 1. Primary check: backend /api/auth/me with Supabase JWT (pass explicit token)
    try {
      const serverProfile = await getAuthUserProfile(currentSession.access_token);
      if (serverProfile && serverProfile.role) {
        role = serverProfile.role;
        if (serverProfile.full_name) {
          fullName = serverProfile.full_name;
        }
        return {
          id: authUser.id,
          email,
          role,
          fullName,
        };
      }
    } catch {
      // 2. Fallback check: query Supabase profiles table directly using client session
      try {
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('role, full_name')
          .or(`user_id.eq.${authUser.id},id.eq.${authUser.id}`)
          .maybeSingle();

        if (!profileErr && profileData && profileData.role) {
          role = profileData.role;
          fullName = profileData.full_name || fullName;
          return {
            id: authUser.id,
            email,
            role,
            fullName,
          };
        }
      } catch {
        // preserve role from metadata or citizen
      }
    }

    return {
      id: authUser.id,
      email,
      role,
      fullName,
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      setSession(null);
      setUser(null);
    }
  }, []);

  // Initialize session and subscribe to auth changes
  useEffect(() => {
    let mounted = true;

    // Register session expiry callback for auto-logout
    registerSessionExpiryHandler(() => {
      logout();
    });

    // 1. Initial startup session check
    supabase.auth.getSession().then(async ({ data: { session: initialSession }, error }) => {
      if (!mounted) return;
      if (error) {
        console.warn('Error reading initial session:', error.message);
      }

      if (initialSession) {
        const verifiedUser = await verifyServerRole(initialSession);
        if (mounted) {
          setSession(initialSession);
          setUser(verifiedUser);
        }
      } else {
        setSession(null);
        setUser(null);
      }
      if (mounted) {
        setLoading(false);
      }
    });

    // 2. Auth state subscription
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !currentSession) {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const verifiedUser = await verifyServerRole(currentSession);
        if (mounted) {
          setSession(currentSession);
          // Never downgrade an already verified authority user during background refresh/re-check
          setUser((prev) => {
            if (prev?.role === 'authority' && verifiedUser?.role !== 'authority') {
              return prev;
            }
            return verifiedUser;
          });
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [verifyServerRole, logout]);

  // Login handler using email and password
  const login = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<{ success: boolean; error?: string; isAuthority?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid municipal email address.' };
    }
    if (!password) {
      return { success: false, error: 'Password is required.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.session || !data.user) {
        return { success: false, error: 'Authentication failed. Please try again.' };
      }

      const verified = await verifyServerRole(data.session);
      setSession(data.session);
      setUser(verified);

      const hasAuthorityRole = verified?.role === 'authority';
      return {
        success: true,
        isAuthority: hasAuthorityRole,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'An unexpected error occurred during sign in.',
      };
    }
  };

  const isAuthority = user?.role === 'authority';
  const token = session?.access_token || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        token,
        loading,
        isAuthority,
        login,
        logout,
        verifyServerRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
