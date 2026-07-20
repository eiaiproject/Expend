import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSecurity } from '../../contexts/SecurityContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Lock, X } from 'reicon-react';

interface VerifyCurrentPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export function VerifyCurrentPinModal({ isOpen, onClose, onVerified }: VerifyCurrentPinModalProps) {
  const { t } = useTranslation();
  const { unlock, pinLength } = useSecurity();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const dialogRef = useFocusTrap(isOpen);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(false);
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleVerify = async () => {
    if (pin.length < pinLength) return;
    setLoading(true);
    const ok = await unlock(pin);
    setLoading(false);
    if (ok) {
      setPin('');
      onVerified();
      onClose();
    } else {
      setError(true);
      setPin('');
      setTimeout(() => setError(false), 1500);
    }
  };

  if (!isOpen) return null;

  return (
    <div ref={dialogRef} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label={t('Enter your current PIN')}>
      <div
        className="bg-[var(--card)] rounded-2xl w-full max-w-sm p-6 space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
            <Lock size={28} className="text-[var(--accent)]" />
          </div>
          <h2 className="text-lg font-bold">{t('Enter Current PIN')}</h2>
          <p className="text-sm text-[var(--text-secondary)]">{t('Enter your current PIN to proceed')}</p>
        </div>

        <div className="flex justify-center gap-4">
          {[...Array(pinLength)].map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-colors ${i < pin.length ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'} ${error ? 'bg-red-500' : ''}`}
            />
          ))}
        </div>

        {error && <p className="text-center text-sm text-red-500" aria-live="polite">{t('Incorrect PIN')}</p>}

        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pin}
          onChange={(e) => { setError(false); setPin(e.target.value.replace(/\D/g, '').slice(0, pinLength)); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleVerify(); }}
          className="w-full h-0 opacity-0 absolute"
        />

        <div className="grid grid-cols-3 gap-3" role="group" aria-label={t('PIN entry')}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => { if (pin.length < pinLength) setPin(prev => prev + num); }}
              className="h-12 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-lg font-mono font-medium hover:bg-[var(--card)] active:scale-95 transition-colors"
            >{num}</button>
          ))}
          <button
            type="button"
            onClick={() => setPin(prev => prev.slice(0, -1))}
            className="h-12 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center hover:bg-[var(--card)] active:scale-95 transition-colors"
            aria-label={t('Delete digit')}
          >
            <X size={20} />
          </button>
          <button
            type="button"
            onClick={() => { if (pin.length < pinLength) setPin(prev => prev + '0'); }}
            className="h-12 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-lg font-mono font-medium hover:bg-[var(--card)] active:scale-95 transition-colors"
          >0</button>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl border border-[var(--border)] font-medium hover:bg-[var(--bg)] transition-colors">
            {t('Cancel')}
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={pin.length < pinLength || loading}
            className="flex-1 h-11 rounded-xl bg-[var(--accent)] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-colors"
          >
            {loading ? t('Verifying...') : t('Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
