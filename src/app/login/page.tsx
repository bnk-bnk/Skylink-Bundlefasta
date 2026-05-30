'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, Lock, Key, Zap, CheckCircle } from 'lucide-react';
import { loginAction, demoLoginAction } from './actions';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await loginAction({ email, authPin: password });
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
          router.refresh();
        }, 800);
      } else {
        setError(res.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await demoLoginAction();
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/dashboard');
          router.refresh();
        }, 800);
      } else {
        setError(res.error || 'Demo initialization failed');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during seeding.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 font-outfit text-text-main antialiased transition-colors">
      <div className="bg-panel border border-border-main rounded-xl p-8 w-full max-w-md shadow-lg space-y-6">
        
        {/* Title / Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-white font-extrabold text-xl shadow-sm">
            SL
          </div>
          <div>
            <h2 className="font-extrabold text-2xl tracking-tight">Skylink OS</h2>
            <p className="text-xs text-muted-main mt-1">Safaricom PayBill Operating System</p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-main uppercase tracking-wider mb-1">
              Operator Email
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-3 text-muted-main" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-sm pl-9 pr-3 py-2.5 border border-border-main rounded-lg bg-background text-text-main focus:outline-none focus:border-accent"
                placeholder="operator@company.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-main uppercase tracking-wider mb-1">
              Operator Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-3 text-muted-main" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm pl-9 pr-3 py-2.5 border border-border-main rounded-lg bg-background text-text-main focus:outline-none focus:border-accent"
                placeholder="Enter password"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-danger font-semibold bg-danger/10 p-2.5 rounded-lg text-center leading-relaxed">
              {error}
            </p>
          )}

          {success && (
            <div className="flex items-center justify-center gap-2 p-2.5 bg-success-main/10 text-success-main border border-success-main/20 rounded-lg text-xs font-bold">
              <CheckCircle size={16} />
              <span>Authentication success! Redirecting...</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || demoLoading}
            className="w-full py-3 bg-text-main hover:opacity-90 disabled:opacity-50 text-panel font-semibold text-sm rounded-lg shadow-sm active:scale-[0.98] transition-all"
          >
            {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
          </button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-main"></div>
          </div>
          <span className="relative bg-panel px-3 text-[10px] font-semibold text-muted-main uppercase tracking-wider">
            Development Shortcuts
          </span>
        </div>

        {/* Demo Login Trigger */}
        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={loading || demoLoading}
          className="w-full flex items-center justify-center gap-2 py-3 border border-accent/30 bg-accent/5 hover:bg-accent/10 disabled:opacity-50 text-accent font-bold text-xs rounded-lg transition-all active:scale-[0.98] shadow-sm"
        >
          <Zap size={14} className={demoLoading ? 'animate-bounce' : ''} />
          {demoLoading ? 'Auto-Seeding Account...' : 'Quick Demo Seed & Login'}
        </button>
        
        <p className="text-[10px] text-muted-main text-center leading-relaxed">
          Demo login maps reference points <span className="font-mono font-bold text-text-main">PESATRIX</span> and <span className="font-mono font-bold text-text-main">BINGWAZONE</span>, seeds transactions, and configures the authorization PIN to <span className="font-mono font-bold text-text-main">123456</span>.
        </p>

      </div>
    </div>
  );
}
