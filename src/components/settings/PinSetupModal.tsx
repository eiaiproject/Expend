import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { MAX_PIN_LENGTH, MIN_PIN_LENGTH } from '../../utils/constants';
import { Lock, X, Eye, EyeOff, Info } from 'lucide-react';

interface PinSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pin: string) => void | Promise<void>;
}

export function PinSetupModal({ isOpen, onClose, onSuccess }: PinSetupModalProps) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const dialogRef = useFocusTrap(isOpen);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setConfirmPin('');
      setStep(1);
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current && !isSubmitting) {
      inputRef.current.focus();
    }
  }, [isOpen, step, isSubmitting]);

  const handleNextStep = () => {
    if (pin.length >= MIN_PIN_LENGTH) {
      setStep(2);
    }
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    if (confirmPin !== pin) {
      setError(t('PINs do not match'));
      setConfirmPin('');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSuccess(pin);
      onClose();
    } catch {
      setError(t('Action failed'));
      setIsSubmitting(false);
    }
  };

  const handlePinChange = (value: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const numeric = value.replace(/\D/g, '').slice(0, MAX_PIN_LENGTH);
    setter(numeric);
  };

  const renderPinDots = (value: string) => (
    <div className="flex justify-center gap-4">
      {[...Array(MAX_PIN_LENGTH)].map((_, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full transition-colors ${i < value.length ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
        />
      ))}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div ref={dialogRef} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label={step === 1 ? t('Create PIN') : t('Confirm PIN')}>
      <div
        className="bg-[var(--card)] rounded-2xl w-full max-w-sm p-6 space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
            <Lock size={28} className="text-[var(--accent)]" />
          </div>
          <h2 className="text-lg font-bold">
            {step === 1 ? t('Create PIN') : t('Confirm PIN')}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {step === 1 ? t('Enter a 4-6 digit PIN') : t('Re-enter your PIN')}
          </p>
        </div>

        {step === 1 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left dark:border-amber-800 dark:bg-amber-900/20">
            <div className="flex items-start gap-2">
              <Info size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                {t('Security Disclosure')}
              </p>
            </div>
          </div>
        )}

        {renderPinDots(step === 1 ? pin : confirmPin)}

        {error && <p className="text-center text-sm text-red-500" aria-live="polite">{error}</p>}
        
        <input
          ref={inputRef}
          type={showPin ? "text" : "password"}
          inputMode="numeric"
          pattern="[0-9]*"
          value={step === 1 ? pin : confirmPin}
          onChange={(e) => {
            setError('');
            if (step === 1) {
              handlePinChange(e.target.value, setPin);
            } else {
              handlePinChange(e.target.value, setConfirmPin);
            }
          }}
          className="w-full h-0 opacity-0 absolute"
        />

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              type="button"
              key={num}
              disabled={isSubmitting}
              onClick={() => {
                const setter = step === 1 ? setPin : setConfirmPin;
                const value = step === 1 ? pin : confirmPin;
                if (value.length < MAX_PIN_LENGTH) {
                  setter(value + num);
                }
              }}
              className="h-12 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-lg font-mono font-medium hover:bg-[var(--card)] active:scale-95 transition-colors"
            >
              {num}
            </button>
          ))}            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setShowPin(!showPin)}
              className="h-12 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center hover:bg-[var(--card)] active:scale-95 transition-colors"
            aria-label={showPin ? t('Hide PIN') : t('Show PIN')}
          >
            {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                const setter = step === 1 ? setPin : setConfirmPin;
                setter((prev) => prev.slice(0, -1));
              }}
              className="h-12 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center hover:bg-[var(--card)] active:scale-95 transition-colors"
            aria-label={t('Delete digit')}
          >
            <X size={20} />
          </button>            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                const setter = step === 1 ? setPin : setConfirmPin;
                const value = step === 1 ? pin : confirmPin;
                if (value.length < MAX_PIN_LENGTH) {
                  setter(value + '0');
                }
              }}
              className="h-12 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-lg font-mono font-medium hover:bg-[var(--card)] active:scale-95 transition-colors"
          >
            0
          </button>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 h-11 rounded-xl border border-[var(--border)] font-medium hover:bg-[var(--bg)] transition-colors"
          >
            {t('Cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (step === 1) {
                handleNextStep();
              } else if (step === 2) {
                handleConfirm();
              }
            }}
            disabled={isSubmitting || (step === 1 ? pin.length < MIN_PIN_LENGTH : confirmPin.length < MIN_PIN_LENGTH)}
            className="flex-1 h-11 rounded-xl bg-[var(--accent)] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-colors"
          >
            {step === 1 ? t('Next') : t('Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
