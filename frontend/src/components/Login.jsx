import React, { useState } from 'react';
import { login } from '../services/auth';

/**
 * Login page component matching Script Writer's industrial minimalist style.
 */
export default function Login({ onLoginSuccess, isDarkMode = true }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      onLoginSuccess();
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ui-bg-dark p-6">
      <div className="w-full max-w-md animate-soft-in">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-2 h-8 rounded-full bg-soft-teal shadow-[0_0_12px_rgba(45,212,191,0.4)]" />
            <h1 className="text-3xl font-bold tracking-tight text-white uppercase">Script Writer</h1>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Professional AI Narration Studio
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-ui-surface-dark border border-soft-border-dark rounded-3xl p-8 shadow-soft-dark">
          <div className="mb-8">
            <h2 className="text-lg font-bold text-white uppercase tracking-wide">Sign In</h2>
            <p className="text-xs text-slate-500 mt-1">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 animate-soft-in">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" className="text-rose-500 shrink-0">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wide">{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="input-field"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input-field"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-soft-teal text-black py-4 rounded-2xl font-bold uppercase tracking-wider text-sm transition-all duration-300 hover:shadow-[0_0_30px_rgba(45,212,191,0.3)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing In...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-8 uppercase tracking-wider">
          Secure Authentication • Enterprise Ready
        </p>
      </div>
    </div>
  );
}
