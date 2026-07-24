import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSecurity } from '../contexts/SecurityContext';
import { Lock, X } from 'reicon-react';
import { MAX_PIN_LENGTH } from '../utils/constants';

export function LockScreen() {
  const { t } = useTranslation();
  const { unlock, pinLength } = useSecurity();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef(pin);

  // Keep pinRef in sync
  useEffect(() => {
    pinRef.current = pin;
  }, [pin]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handlePinSubmit = useCallback(async () => {
    const currentPin = pinRef.current;
    if (currentPin.length < pinLength) return;

    const success = await unlock(currentPin);
    if (success) {
      setPin('');
      setError(false);
    } else {
      setError(true);
      setPin('');
      setTimeout(() => setError(false), 1000);
    }
  }, [pinLength, unlock]);

  // Auto-submit PIN when length matches stored pinLength
  useEffect(() => {
    if (pin.length >= pinLength) {
      const timer = setTimeout(() => handlePinSubmit(), 100);
      return () => clearTimeout(timer);
    }
  }, [handlePinSubmit, pin, pinLength]);

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, MAX_PIN_LENGTH);
    setPin(value);
  };

  return (
    <div
      className="fixed inset-0 bg-[var(--bg)] z-50 flex flex-col items-center justify-center p-6"
    >
      <div className="w-full max-w-xs space-y-8">
        <div className={`w-20 h-20 mx-auto rounded-full bg-[var(--accent)] flex items-center justify-center ${error ? 'animate-shake' : ''}`}>
          <Lock size={32} className="text-white" />
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold">{t('App Locked')}</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {t('Enter PIN to unlock')}
          </p>
        </div>

        {/* PIN Input */}
        <div className="space-y-6">
          {/* PIN Dots */}
          <div className="flex justify-center gap-4">
            {[...Array(MAX_PIN_LENGTH)].map((_, i) => (
              <div
                key={`pin-${i}`}
                className={`w-4 h-4 rounded-full transition-colors ${
                  i < pin.length ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                } ${error ? 'bg-red-500' : ''}`}
              />
            ))}
          </div>

          {/* Hidden Input */}
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={handlePinChange}
            className="w-full h-0 opacity-0 absolute"
          />

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3" role="group" aria-label={t('PIN entry')}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                onClick={() => setPin(prev => prev.length < MAX_PIN_LENGTH ? prev + num : prev)}
                className="h-14 rounded-xl bg-[var(--card)] border border-[var(--border)] text-lg font-mono font-medium hover:bg-[var(--bg)] active:scale-95 transition-colors"
                aria-label={t('Enter {{num}}', { num })}
              >
                {num}
              </button>
            ))}
            <div aria-hidden="true" />
            <button
              type="button"
              onClick={() => setPin(prev => prev.slice(0, -1))}
              className="h-14 rounded-xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-center hover:bg-[var(--bg)] active:scale-95 transition-colors"
              aria-label={t('Delete')}
            >
              <X size={20} />
            </button>
            <button
              type="button"
              onClick={() => setPin(prev => prev.length < MAX_PIN_LENGTH ? prev + '0' : prev)}
              className="h-14 rounded-xl bg-[var(--card)] border border-[var(--border)] text-lg font-mono font-medium hover:bg-[var(--bg)] active:scale-95 transition-colors"
              aria-label={t('Enter {{num}}', { num: '0' })}
            >
              0
            </button>
          </div>
        </div>

        {error && (
          <p className="text-center text-sm text-red-500" aria-live="polite">{t('Incorrect PIN')}</p>
        )}
      </div>
    </div>
  );
}
