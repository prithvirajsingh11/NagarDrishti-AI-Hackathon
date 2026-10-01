import React, { useEffect, useState } from 'react';
import {
  User,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Camera,
  KeyRound,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export type AuthMode = 'login' | 'signup' | 'forgot-password';

interface AuthPageProps {
  initialMode?: AuthMode;
  reason?: 'report' | 'default';
  initialError?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  reason = 'default',
  initialError = null,
  onSuccess,
  onCancel,
}) => {
  const { t } = useLanguage();
  const { signup, login, resetPassword, citizen, isLoggedIn } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(initialError);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync initialError
  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

  // Clear errors and success messages on tab / mode change
  useEffect(() => {
    setError(null);
    setSuccessMsg(null);
  }, [mode]);

  // Automatically transition out if citizen is authenticated (prevent any dead end)
  useEffect(() => {
    if (isLoggedIn && citizen) {
      onSuccess();
    }
  }, [isLoggedIn, citizen, onSuccess]);

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setError(t('auth.err_name', 'Please enter your full name.'));
      return;
    }
    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setError(t('auth.err_email', 'Please enter a valid email address.'));
      return;
    }
    if (!password || password.length < 6) {
      setError(t('auth.err_password_len', 'Password must be at least 6 characters.'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await signup({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      if (res.success) {
        if (res.needsConfirmation) {
          setSuccessMsg(
            res.message ||
              'Account created successfully. Please verify your email if email confirmation is enabled.'
          );
        } else {
          setSuccessMsg(
            res.message ||
              t('auth.signup_success', 'Account created successfully. Welcome to NagarDrishti AI.')
          );
          // Immediately enter Citizen Home — zero second click!
          onSuccess();
        }
      } else {
        setError(res.error || 'Failed to create citizen account.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !email.includes('@')) {
      setError(t('auth.err_email', 'Please enter a valid email address.'));
      return;
    }
    if (!password) {
      setError(t('auth.err_password_required', 'Please enter your password.'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await login({
        email: email.trim(),
        password,
      });

      if (res.success) {
        setSuccessMsg(t('auth.login_success', 'Welcome back! Signed in successfully.'));
        // Immediately enter Citizen Home — zero second click!
        onSuccess();
      } else {
        setError(res.error || 'Email or password is incorrect.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSuccessMsg(null);

    if (!email.trim() || !email.includes('@')) {
      setError(t('auth.err_email', 'Please enter your registered email address.'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await resetPassword(email.trim());

      if (res.success) {
        setSuccessMsg(
          t(
            'auth.reset_sent',
            'Password reset link sent! Please check your email inbox to update your password.'
          )
        );
      } else {
        setError(res.error || 'Failed to send reset link. Please verify your email.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // If already authenticated, show a clean, seamless transition indicator (no dead end card)
  if (isLoggedIn && citizen) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-8 space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {successMsg || t('auth.login_success', 'Welcome back! Signed in successfully.')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('auth.entering_app', 'Entering citizen application...')}
            </p>
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-slate-700 dark:text-slate-300 mx-auto mt-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 sm:py-8 animate-fade-slide-up">
      {/* Return button */}
      <button
        onClick={() => {
          setError(null);
          setSuccessMsg(null);
          onCancel();
        }}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 mb-4 transition-colors cursor-pointer"
      >
        <ArrowLeft size={13} />
        <span>{t('report.back', 'Back')}</span>
      </button>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-6 sm:p-7 space-y-6">
          {/* Header */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-800 text-white mb-1 shadow-xs border dark:border-slate-700">
              {mode === 'forgot-password' ? <KeyRound size={20} /> : <ShieldCheck size={20} />}
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {mode === 'signup'
                ? t('auth.title_signup', 'Create Citizen Account')
                : mode === 'forgot-password'
                ? t('auth.title_forgot', 'Reset Password')
                : t('auth.title_login', 'Citizen Sign In')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              {mode === 'signup'
                ? t('auth.desc_signup', 'Sign up as an Indian citizen to file and track civic issues')
                : mode === 'forgot-password'
                ? t('auth.desc_forgot', 'Enter your email address to receive password reset instructions')
                : t('auth.desc_login', 'Sign in with your email and password to access your civic reports')}
            </p>
          </div>

          {/* Report Gate Notice */}
          {reason === 'report' && mode !== 'forgot-password' && (
            <div className="flex items-center gap-2.5 p-3 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs shadow-xs">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 text-amber-800 dark:text-amber-300">
                <Camera size={14} />
              </div>
              <div className="min-w-0 text-left">
                <div className="font-semibold text-amber-900 dark:text-amber-200">
                  {t('auth.report_gate_title', 'Citizen Sign In Required')}
                </div>
                <div className="text-[11px] text-amber-700 dark:text-amber-300/80 leading-tight mt-0.5">
                  {t(
                    'auth.report_gate_desc',
                    'Please sign in or create a citizen account before submitting your report.'
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Mode Switcher Tabs (Login / Signup) */}
          {mode !== 'forgot-password' && (
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800/80 p-0.5 border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMsg(null);
                  window.location.hash = 'login';
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t('auth.login', 'Sign In')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setSuccessMsg(null);
                  window.location.hash = 'signup';
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t('auth.signup', 'Sign Up')}
              </button>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-red-800 dark:text-red-300 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
              {mode === 'signup' &&
                (error.toLowerCase().includes('rate-limited') ||
                  error.toLowerCase().includes('rate limit')) && (
                  <div className="pt-0.5 pl-6">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                        setSuccessMsg(null);
                        window.location.hash = 'login';
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-700 hover:bg-red-800 text-white font-medium text-[11px] rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      <span>Sign In Instead</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                )}
              {mode === 'signup' &&
                (error.toLowerCase().includes('already registered') ||
                  error.toLowerCase().includes('already exists')) && (
                  <div className="pt-0.5 pl-6">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                        setSuccessMsg(null);
                        window.location.hash = 'login';
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-700 hover:bg-red-800 text-white font-medium text-[11px] rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      <span>Sign In</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                )}
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* SIGNUP FORM */}
          {mode === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.name', 'Full Name')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (error) setError(null);
                      if (successMsg) setSuccessMsg(null);
                    }}
                    placeholder={t('auth.name_placeholder', 'e.g. Rajesh Kumar')}
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.email', 'Email Address')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                      if (successMsg) setSuccessMsg(null);
                    }}
                    placeholder={t('auth.email_placeholder', 'e.g. citizen@example.com')}
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.password', 'Password')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                      if (successMsg) setSuccessMsg(null);
                    }}
                    placeholder={t('auth.password_placeholder', 'At least 6 characters')}
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  />
                </div>
              </div>

              {/* Citizen role guarantee notice */}
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/70 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                <span>Account will be securely registered with verified <strong>Citizen</strong> privileges.</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[44px] py-2.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 disabled:bg-slate-400 dark:disabled:bg-slate-700 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>{t('auth.creating_account', 'Creating account...')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('auth.btn_create', 'Create Citizen Account')}</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.email', 'Email Address')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                      if (successMsg) setSuccessMsg(null);
                    }}
                    placeholder={t('auth.email_placeholder', 'e.g. citizen@example.com')}
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('auth.password', 'Password')} <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot-password');
                      setError(null);
                      setSuccessMsg(null);
                      window.location.hash = 'forgot-password';
                    }}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {t('auth.forgot_password', 'Forgot password?')}
                  </button>
                </div>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                      if (successMsg) setSuccessMsg(null);
                    }}
                    placeholder={t('auth.password_placeholder', 'Enter your password')}
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[44px] py-2.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 disabled:bg-slate-400 dark:disabled:bg-slate-700 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>{t('auth.signing_in', 'Signing in...')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('auth.btn_login', 'Sign In')}</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === 'forgot-password' && (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.email', 'Email Address')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                      if (successMsg) setSuccessMsg(null);
                    }}
                    placeholder={t('auth.email_placeholder', 'e.g. your.email@example.com')}
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[44px] py-2.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 disabled:bg-slate-400 dark:disabled:bg-slate-700 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>{t('auth.sending_reset', 'Sending reset link...')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('auth.send_reset', 'Send Password Reset Link')}</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setSuccessMsg(null);
                    window.location.hash = 'login';
                  }}
                  className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft size={12} />
                  <span>{t('auth.return_login', 'Return to Sign In')}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
