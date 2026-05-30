'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X } from 'lucide-react';
import { verifyPinAction } from '@/app/actions';

interface PinConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void;
  title?: string;
  description?: string;
}

export default function PinConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Security PIN',
  description = 'Please enter your dashboard security PIN to authorize this critical operational transaction.',
}: PinConfirmModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;

    setLoading(true);
    setError(null);
    try {
      const isValid = await verifyPinAction(pin);
      if (isValid) {
        onConfirm(pin);
        setPin('');
        onClose();
      } else {
        setError('Invalid security PIN code. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during verification.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-panel border border-border-main rounded-xl p-6 w-full max-w-sm shadow-xl relative"
          >
            <button
              onClick={onClose}
              disabled={loading}
              className="absolute top-4 right-4 text-muted-main hover:text-text-main p-1 hover:bg-background border border-border-main rounded-md disabled:opacity-50"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-warning-main/10 flex items-center justify-center text-warning-main shrink-0">
                <ShieldCheck size={24} />
              </div>
              
              <h3 className="font-bold text-lg">{title}</h3>
              <p className="text-xs text-muted-main leading-relaxed">{description}</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <input
                  type="password"
                  required
                  autoFocus
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-widest text-lg font-bold py-2.5 px-3 border border-border-main rounded-lg bg-background focus:outline-none focus:border-accent"
                  placeholder="••••••"
                />
              </div>

              {error && (
                <p className="text-xs text-danger font-semibold bg-danger/10 p-2 rounded-lg text-center">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || pin.length < 4}
                className="w-full py-2.5 bg-text-main hover:opacity-90 disabled:opacity-50 text-panel font-semibold text-sm rounded-lg shadow-sm active:scale-[0.98] transition-all"
              >
                {loading ? 'Verifying PIN...' : 'Authorize Transaction'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
