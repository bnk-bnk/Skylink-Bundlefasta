'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { hasPinAction, verifyPinAction, setPinAction, updatePasswordAction } from '@/app/actions';

export default function SettingsView() {
  // PIN states
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');

  // Password states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  const checkPinConfiguration = async () => {
    try {
      const config = await hasPinAction();
      setHasPin(config);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    checkPinConfiguration();
  }, []);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess('');

    if (!/^\d{6}$/.test(newPin)) {
      setPinError('New PIN must be exactly 6 digits.');
      return;
    }

    if (newPin !== confirmPin) {
      setPinError('New PINs do not match.');
      return;
    }

    setPinLoading(true);

    try {
      // If PIN is already configured, verify current PIN
      if (hasPin) {
        if (!currentPin) {
          setPinError('Current PIN is required.');
          setPinLoading(false);
          return;
        }
        const isValid = await verifyPinAction(currentPin);
        if (!isValid) {
          setPinError('Incorrect current Dashboard PIN.');
          setPinLoading(false);
          return;
        }
      }

      // Save new PIN
      const res = await setPinAction(newPin);
      if (res) {
        setPinSuccess('Dashboard PIN updated successfully.');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        checkPinConfiguration();
      } else {
        setPinError('Failed to set new Dashboard PIN.');
      }
    } catch (err: any) {
      setPinError(err.message || 'An error occurred.');
    } finally {
      setPinLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (password.length < 6) {
      setPassError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setPassError('Passwords do not match.');
      return;
    }

    setPassLoading(true);

    try {
      const res = await updatePasswordAction(password);
      if (res.success) {
        setPassSuccess('Operator Password updated successfully.');
        setPassword('');
        setConfirmPassword('');
      } else {
        setPassError(res.error || 'Failed to update password.');
      }
    } catch (err: any) {
      setPassError(err.message || 'An error occurred.');
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-outfit antialiased max-w-4xl">
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Dashboard PIN settings */}
        <div className="bg-panel border border-border-main rounded-2xl p-5 md:p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-accent/10 text-accent rounded-lg">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-text-main">Dashboard PIN Management</h3>
                <p className="text-xs text-muted-main">Authorized PIN required to confirm outgoing payments (STK, B2C, Reversals)</p>
              </div>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4 pt-2">
              {pinError && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-semibold flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>{pinError}</span>
                </div>
              )}

              {pinSuccess && (
                <div className="p-3 rounded-xl bg-success-main/10 border border-success-main/20 text-success-main text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  <span>{pinSuccess}</span>
                </div>
              )}

              {hasPin === null ? (
                <div className="flex items-center gap-2 text-xs text-muted-main py-4">
                  <RefreshCw className="animate-spin text-accent" size={14} />
                  <span>Checking status...</span>
                </div>
              ) : (
                <>
                  {hasPin && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-main/70 ml-0.5">Current Dashboard PIN</label>
                      <input
                        type="password"
                        required
                        maxLength={6}
                        value={currentPin}
                        onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-background border border-border-main rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent sm:text-xs text-text-main font-mono text-center tracking-widest"
                        placeholder="••••••"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-main/70 ml-0.5">
                      {hasPin ? 'New 6-Digit PIN' : 'Create 6-Digit PIN'}
                    </label>
                    <input
                      type="password"
                      required
                      maxLength={6}
                      value={newPin}
                      onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-background border border-border-main rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent sm:text-xs text-text-main font-mono text-center tracking-widest"
                      placeholder="••••••"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-main/70 ml-0.5">Confirm New PIN</label>
                    <input
                      type="password"
                      required
                      maxLength={6}
                      value={confirmPin}
                      onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-background border border-border-main rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent sm:text-xs text-text-main font-mono text-center tracking-widest"
                      placeholder="••••••"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={pinLoading || !newPin || confirmPin.length < 6}
                    className="w-full mt-2 py-2 px-4 bg-accent hover:opacity-90 text-white rounded-xl text-xs font-semibold transition-all focus:outline-none disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {pinLoading ? (
                      <>
                        <RefreshCw className="animate-spin" size={14} />
                        <span>Updating PIN...</span>
                      </>
                    ) : (
                      <span>{hasPin ? 'Update PIN' : 'Create PIN'}</span>
                    )}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>

        {/* Card 2: Password Reset settings */}
        <div className="bg-panel border border-border-main rounded-2xl p-5 md:p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-success-main/10 text-success-main rounded-lg">
                <Key size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-text-main">Change Password</h3>
                <p className="text-xs text-muted-main">Update password used to sign in as operator</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-2">
              {passError && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-semibold flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>{passError}</span>
                </div>
              )}

              {passSuccess && (
                <div className="p-3 rounded-xl bg-success-main/10 border border-success-main/20 text-success-main text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  <span>{passSuccess}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-main/70 ml-0.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-background border border-border-main rounded-xl py-2 px-3 pr-10 focus:outline-none focus:ring-2 focus:ring-accent sm:text-xs text-text-main font-semibold"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-main hover:text-text-main transition-colors cursor-pointer p-0.5"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-main/70 ml-0.5">Confirm New Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-background border border-border-main rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent sm:text-xs text-text-main font-semibold"
                  placeholder="Confirm new password"
                />
              </div>

              <button
                type="submit"
                disabled={passLoading || !password || confirmPassword.length < 6}
                className="w-full mt-2 py-2 px-4 bg-success-main hover:opacity-90 text-white rounded-xl text-xs font-semibold transition-all focus:outline-none disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {passLoading ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </form>
          </div>
        </div>

      </div>

    </div>
  );
}
