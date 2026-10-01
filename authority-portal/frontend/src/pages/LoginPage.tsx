import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, AlertCircle, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { CITIZEN_PORTAL_URL } from '../services/api';
import { NagarDrishtiLogo } from '../components/NagarDrishtiLogo';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onAccessDenied: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onAccessDenied }) => {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await login({ email, password });
      if (!res.success) {
        setErrorMessage(res.error || 'Authentication failed. Please verify your credentials.');
        setLoading(false);
        return;
      }

      if (res.isAuthority) {
        onLoginSuccess();
      } else {
        // Authenticated citizen attempting authority portal access
        onAccessDenied();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while connecting to the authority service.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center px-4 py-8 sm:py-12 relative overflow-hidden select-none transition-colors duration-200">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-xs transition-colors cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-500" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6 sm:mb-8">
          <NagarDrishtiLogo size={48} className="mx-auto mb-3" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            NagarDrishti AI
          </h1>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">
            Authority Portal
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Municipal Civic Intelligence
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 shadow-sm transition-colors">
          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-rose-700 dark:text-rose-300 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="authority-email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="authority-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@municipal.gov"
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="authority-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="authority-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  className="w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-950 text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Access notice */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
              Authorized municipal government personnel only.
              <br />
              All login attempts and spatial queries are audited.
            </p>
          </div>
        </div>

        {/* Back to Citizen Portal */}
        <div className="mt-6 text-center">
          <a
            href={CITIZEN_PORTAL_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            Looking for public reporting? <span className="font-semibold underline">Go to Citizen Portal â†’</span>
          </a>
        </div>
      </div>
    </div>
  );
};
