'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, Mail } from 'lucide-react';
import {
  hasPinAction,
  verifyPinAction,
  setPinAction,
  updatePasswordAction,
  getSmsSettingsAction,
  updateSmsSettingsAction,
  sendTestNotificationAction
} from '@/app/actions';

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

  // SMS Alert States
  const [adminPhone, setAdminPhone] = useState('');
  const [senderId, setSenderId] = useState('');
  const [incomingEnabled, setIncomingEnabled] = useState(true);
  const [outgoingEnabled, setOutgoingEnabled] = useState(true);
  const [pesafrixTillNumber, setPesafrixTillNumber] = useState('');
  
  const [notificationChannel, setNotificationChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [testLoading, setTestLoading] = useState(false);
  
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState('');
  const [smsSuccess, setSmsSuccess] = useState('');

  const checkPinConfiguration = async () => {
    try {
      const config = await hasPinAction();
      setHasPin(config);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSmsSettings = async () => {
    try {
      const data = await getSmsSettingsAction();
      if (data) {
        setAdminPhone(data.admin_alert_phone || '');
        setSenderId(data.sender_id || '');
        setIncomingEnabled(data.incoming_alerts_enabled);
        setOutgoingEnabled(data.outgoing_alerts_enabled);
        setPesafrixTillNumber(data.pesafrix_till_number || '');
        setNotificationChannel((data.notification_channel as 'sms' | 'whatsapp') || 'sms');
      }
    } catch (err) {
      console.error('Failed to load SMS settings:', err);
    }
  };

  useEffect(() => {
    checkPinConfiguration();
    loadSmsSettings();
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

  const handleSmsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmsError('');
    setSmsSuccess('');
    setSmsLoading(true);

    try {
      await updateSmsSettingsAction({
        admin_alert_phone: adminPhone,
        sender_id: senderId,
        incoming_alerts_enabled: incomingEnabled,
        outgoing_alerts_enabled: outgoingEnabled,
        pesafrix_till_number: pesafrixTillNumber,
        notification_channel: notificationChannel
      });
      setSmsSuccess('Configurations updated successfully.');
    } catch (err: any) {
      setSmsError(err.message || 'Failed to update configurations.');
    } finally {
      setSmsLoading(false);
    }
  };

  const handleSendTest = async () => {
    setSmsError('');
    setSmsSuccess('');
    setTestLoading(true);
    try {
      const res = await sendTestNotificationAction();
      if (res.success) {
        setSmsSuccess(`Test notification triggered successfully via ${notificationChannel.toUpperCase()}.`);
      } else {
        setSmsError(`Test notification failed: ${res.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setSmsError(err.message || 'Failed to trigger test notification.');
    } finally {
      setTestLoading(false);
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

        {/* Card 3: SMS Alerts Configuration */}
        <div className="bg-panel border border-border-main rounded-2xl p-5 md:p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-warning-main/10 text-warning-main rounded-lg">
                <Mail size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-text-main">SMS Alert Configuration</h3>
                <p className="text-xs text-muted-main">Configure administrator phone alert rules for PayBill inflows and outflows</p>
              </div>
            </div>

            <form onSubmit={handleSmsSubmit} className="space-y-4 pt-2">
              {smsError && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-semibold flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>{smsError}</span>
                </div>
              )}

              {smsSuccess && (
                <div className="p-3 rounded-xl bg-success-main/10 border border-success-main/20 text-success-main text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  <span>{smsSuccess}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-main/70 ml-0.5">Notification Channel</label>
                <select
                  value={notificationChannel}
                  onChange={e => setNotificationChannel(e.target.value as 'sms' | 'whatsapp')}
                  className="w-full bg-background border border-border-main rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent sm:text-xs text-text-main font-semibold cursor-pointer"
                >
                  <option value="sms">SMS Channel (BlazeTech Scope SMS)</option>
                  <option value="whatsapp">WhatsApp Channel (Evolution WhatsApp API)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-main/70 ml-0.5">Admin Alert Phone</label>
                <input
                  type="text"
                  required
                  value={adminPhone}
                  onChange={e => setAdminPhone(e.target.value)}
                  className="w-full bg-background border border-border-main rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent sm:text-xs text-text-main font-mono"
                  placeholder="2547XXXXXXXX"
                />
                <p className="text-[9px] text-muted-main">Alert messages will be sent to this phone number</p>
              </div>

              {notificationChannel === 'sms' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-main/70 ml-0.5">Sender ID</label>
                  <input
                    type="text"
                    required
                    value={senderId}
                    onChange={e => setSenderId(e.target.value)}
                    className="w-full bg-background border border-border-main rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent sm:text-xs text-text-main font-mono"
                    placeholder="e.g. BLAZETECH"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-main/70 ml-0.5">Pesafrix Settlement Till</label>
                <input
                  type="text"
                  value={pesafrixTillNumber}
                  onChange={e => setPesafrixTillNumber(e.target.value)}
                  className="w-full bg-background border border-border-main rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent sm:text-xs text-text-main font-mono"
                  placeholder="e.g. 543210"
                />
                <p className="text-[9px] text-muted-main">Till number used by the auto B2B settlement engine for PESATRIX/PESAFRIX transactions</p>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-xs font-semibold text-text-main/80 block">Alert Toggles</label>
                
                <div className="flex items-center justify-between py-1 border-b border-border-main/55">
                  <div>
                    <span className="text-xs font-medium text-text-main">Incoming Alerts</span>
                    <p className="text-[10px] text-muted-main">Receive alerts on successful C2B/STK push payments</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={incomingEnabled}
                      onChange={e => setIncomingEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-border-main peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-xs font-medium text-text-main">Outgoing Alerts</span>
                    <p className="text-[10px] text-muted-main">Receive alerts on B2C payouts, B2B settlements, and reversals</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={outgoingEnabled}
                      onChange={e => setOutgoingEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-border-main peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                  </label>
                </div>
              </div>

              <div className="flex gap-2.5 mt-2">
                <button
                  type="submit"
                  disabled={smsLoading || testLoading || !adminPhone || (notificationChannel === 'sms' && !senderId)}
                  className="flex-1 py-2 px-4 bg-accent hover:opacity-90 text-panel rounded-xl text-xs font-semibold transition-all focus:outline-none disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {smsLoading ? (
                    <>
                      <RefreshCw className="animate-spin text-panel" size={14} />
                      <span>Saving configurations...</span>
                    </>
                  ) : (
                    <span>Save Configurations</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={smsLoading || testLoading || !adminPhone}
                  className="py-2 px-4 bg-panel hover:bg-background border border-border-main text-text-main rounded-xl text-xs font-semibold transition-all focus:outline-none disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  {testLoading ? (
                    <>
                      <RefreshCw className="animate-spin" size={14} />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <span>Send Test</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>

    </div>
  );
}
