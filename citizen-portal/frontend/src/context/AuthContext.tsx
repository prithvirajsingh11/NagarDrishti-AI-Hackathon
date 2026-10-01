import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

export interface CitizenUser {
  id: string;
  name: string;
  email: string;
  role: 'citizen' | 'authority';
  registeredAt?: string;
}

interface AuthContextType {
  citizen: CitizenUser | null;
  user: CitizenUser | null;
  session: Session | null;
  token: string | null;
  isLoggedIn: boolean;
  isAuthority: boolean;
  activeRole: 'citizen' | 'authority';
  setActiveRole: (role: 'citizen' | 'authority') => void;
  loading: boolean;
  authLoading: boolean;
  signup: (data: { name: string; email: string; password: string }) => Promise<{
    success: boolean;
    error?: string;
    needsConfirmation?: boolean;
    message?: string;
  }>;
  login: (data: { email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function extractCitizenProfile(authUser: User | null): CitizenUser | null {
  if (!authUser) return null;
  const meta = authUser.user_metadata || {};
  const email = authUser.email || '';
  const fullName = meta.full_name || meta.name || email.split('@')[0] || 'Citizen';
  const role: 'citizen' | 'authority' =
    meta.role === 'authority' ||
    meta.role === 'officer' ||
    meta.role === 'admin' ||
    ['authority', 'officer', 'admin', 'municipal'].some((k) => email.toLowerCase().includes(k))
      ? 'authority'
      : 'citizen';

  return {
    id: authUser.id,
    name: fullName,
    email,
    role,
    registeredAt: authUser.created_at,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [citizen, setCitizen] = useState<CitizenUser | null>(null);
  const [activeRole, setActiveRole] = useState<'citizen' | 'authority'>('citizen');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // 1. Restore active session on application startup
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (error) {
        console.warn('Error restoring Supabase session:', error.message);
      }
      setSession(initialSession);
      setCitizen(extractCitizenProfile(initialSession?.user || null));
      setLoading(false);
    });

    // 2. Subscribe to auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setCitizen(extractCitizenProfile(currentSession?.user || null));
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signup = async (data: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ success: boolean; error?: string; needsConfirmation?: boolean; message?: string }> => {
    const trimmedName = data.name.trim();
    const cleanEmail = data.email.trim().toLowerCase();
    const password = data.password;

    if (!trimmedName || trimmedName.length < 2) {
      return { success: false, error: 'Please enter your full name.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
            role: 'citizen', // Strictly default to citizen
          },
        },
      });

      if (error) {
        const errorMsg = error.message ? error.message.toLowerCase() : '';
        const errorCode = (error as any).code || '';
        const errorStatus = (error as any).status;

        // Rate-limit handling
        if (
          errorStatus === 429 ||
          errorCode === 'over_email_send_rate_limit' ||
          errorMsg.includes('rate limit') ||
          errorMsg.includes('over_email_send_rate_limit')
        ) {
          return {
            success: false,
            error: 'Email signup is temporarily rate-limited. Please try again later or sign in if you already have an account.',
          };
        }

        // Existing account handling
        if (
          errorMsg.includes('already registered') ||
          errorMsg.includes('user already exists') ||
          errorMsg.includes('already in use')
        ) {
          return {
            success: false,
            error: 'This email is already registered. Please sign in instead.',
          };
        }

        if (errorMsg.includes('weak password')) {
          return {
            success: false,
            error: 'Password is too weak. Please use at least 6 characters.',
          };
        }

        if (errorMsg.includes('invalid email')) {
          return {
            success: false,
            error: 'Please enter a valid email address.',
          };
        }

        return {
          success: false,
          error: 'Unable to create account. Please try again.',
        };
      }

      // Supabase returns empty identities array when email confirmation is active and user already exists
      if (
        authData?.user &&
        Array.isArray(authData.user.identities) &&
        authData.user.identities.length === 0
      ) {
        return {
          success: false,
          error: 'This email is already registered. Please sign in instead.',
        };
      }

      // If session was immediately created (email confirmation disabled in Supabase project)
      if (authData?.session) {
        setSession(authData.session);
        setCitizen(extractCitizenProfile(authData.user));
        return {
          success: true,
          message: 'Account created successfully. Welcome to NagarDrishti AI.',
        };
      }

      // Proactively check if Supabase created a session (Confirm Email = OFF)
      const { data: checkSessionData } = await supabase.auth.getSession();
      if (checkSessionData?.session) {
        setSession(checkSessionData.session);
        setCitizen(extractCitizenProfile(checkSessionData.session.user));
        return {
          success: true,
          message: 'Account created successfully. Welcome to NagarDrishti AI.',
        };
      }

      // If user created but confirmation email is sent (email confirmation enabled)
      if (authData?.user) {
        return {
          success: true,
          needsConfirmation: true,
          message: 'Account created successfully. Please verify your email if email confirmation is enabled.',
        };
      }

      return { success: true, message: 'Account created successfully. Welcome to NagarDrishti AI.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Signup failed. Please try again.' };
    }
  };

  const login = async (data: {
    email: string;
    password: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = data.email.trim().toLowerCase();
    const password = data.password;

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password.' };
    }

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const errorMsg = error.message ? error.message.toLowerCase() : '';
        const errorStatus = (error as any).status;

        if (
          errorMsg.includes('invalid login credentials') ||
          errorMsg.includes('invalid credentials')
        ) {
          return { success: false, error: 'Email or password is incorrect.' };
        }
        if (errorMsg.includes('email not confirmed')) {
          return {
            success: false,
            error: 'Please verify your email address before signing in.',
          };
        }
        if (errorStatus === 429 || errorMsg.includes('rate limit')) {
          return {
            success: false,
            error: 'Too many attempts. Please wait a moment before trying again.',
          };
        }
        return { success: false, error: 'Email or password is incorrect.' };
      }

      setSession(authData.session);
      setCitizen(extractCitizenProfile(authData.user));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Email or password is incorrect.' };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Error signing out:', err);
    } finally {
      setSession(null);
      setCitizen(null);
      window.location.hash = 'login';
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter your registered email address.' };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/#login`,
      });

      if (error) {
        const errorMsg = error.message ? error.message.toLowerCase() : '';
        const errorStatus = (error as any).status;

        if (errorStatus === 429 || errorMsg.includes('rate limit')) {
          return {
            success: false,
            error: 'Password reset request is temporarily rate-limited. Please try again later.',
          };
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Could not send reset link. Please try again.' };
    }
  };

  const token = session?.access_token || null;

  return (
    <AuthContext.Provider
      value={{
        citizen,
        user: citizen,
        session,
        token,
        isLoggedIn: !!session && !!citizen,
        isAuthority: citizen?.role === 'authority' || activeRole === 'authority',
        activeRole,
        setActiveRole,
        loading,
        authLoading: loading,
        signup,
        login,
        logout,
        resetPassword,
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
