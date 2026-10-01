import React from 'react';
import { ShieldAlert, ArrowLeft, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { CITIZEN_PORTAL_URL } from '../services/api';

interface AccessDeniedPageProps {
  onBackToLogin: () => void;
}

export const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({ onBackToLogin }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleReturnToLogin = async () => {
    await logout();
    onBackToLogin();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center px-4 py-8 sm:py-12 text-center select-none transition-colors duration-200 relative">
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

      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 shadow-sm transition-colors">
        {/* Warning Icon */}
        <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto mb-4 shadow-xs">
          <ShieldAlert className="w-6 h-6" />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Access Restricted
        </h1>

        {/* Message */}
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
          This portal is available only to authorized municipal authority users.
        </p>

        {user && (
          <div className="mt-5 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Signed-in Account
            </span>
            <p className="text-xs font-mono text-slate-800 dark:text-slate-200 mt-0.5 truncate">{user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Assigned Role:</span>
              <span className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold uppercase font-mono">
                {user.role}
              </span>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-6 space-y-3">
          <button
            onClick={handleReturnToLogin}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-950 text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Login</span>
          </button>

          <a
            href={CITIZEN_PORTAL_URL}
            target="_blank"
            rel="noreferrer"
            className="block text-xs text-blue-600 dark:text-blue-400 hover:underline transition-colors"
          >
            Go to NagarDrishti Citizen Portal →
          </a>
        </div>
      </div>
    </div>
  );
};
