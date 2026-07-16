import { useState, useRef, useEffect } from 'react';
import { toast } from './Toaster';
import { useTranslation } from 'react-i18next';
import { Wallet, Tag, Check, ArrowRight, ArrowLeft, Sparkles, Info } from 'lucide-react';
import { db } from '../db/db';
import { cn } from '../utils/cn';
import { CURATED_PALETTE, DEFAULT_CATEGORIES, STORAGE_KEYS } from '../utils/constants';

interface OnboardingWizardProps {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [walletName, setWalletName] = useState('');
  const [walletBalance, setWalletBalance] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const walletNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1 && walletNameInputRef.current) {
      walletNameInputRef.current.focus();
    }
  }, [step]);

  const toggleCategory = (nameKey: string) => {
    setSelectedCategories(prev =>
      prev.includes(nameKey) ? prev.filter(key => key !== nameKey) : [...prev, nameKey]
    );
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      // Create wallet
      if (walletName.trim()) {
        const parsedBalance = Number.parseInt(walletBalance.replace(/\D/g, '') || '0', 10);
        await db.wallets.add({
          name: walletName.trim(),
          currency: 'IDR',
          initialBalance: parsedBalance,
          currentBalance: parsedBalance, // ponytail: keeps initial balance queryable from DB without recompute
          lastUpdated: new Date().toISOString(),
        });
      }

      const existingColors = await db.categories.toArray().then(cats => new Set(cats.map(c => c.color)));
      for (const categoryKey of selectedCategories) {
        const cat = DEFAULT_CATEGORIES.find(c => c.nameKey === categoryKey);
        const availableColors = [...CURATED_PALETTE].filter(c => !existingColors.has(c));
        const fallbackColor = (availableColors[Math.floor(Math.random() * availableColors.length)]
          ?? CURATED_PALETTE[Math.floor(Math.random() * CURATED_PALETTE.length)])!;
        const color: string = cat?.color ?? fallbackColor;

        existingColors.add(color);

        await db.categories.add({
          name: t(categoryKey),
          icon: '🏷️',
          color: color,
        });
      }

      localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
      onComplete();
    } catch (err) {
      console.error('Onboarding failed:', err);
      // Don't auto-complete — let user retry instead of getting stuck without data
      toast.add(t('Onboarding failed. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-[var(--bg)] flex flex-col"
    >
      {/* Progress Bar */}
      <div className="flex gap-1.5 p-4 pt-8">
        {[1, 2, 3].map(s => (
          <div
            key={s}
            className={cn(
              'flex-1 h-1 rounded-full transition-[width,background-color] duration-500',
              s <= step ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
            )}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col px-6 overflow-y-auto">
        <>
          {/* Step 1: Create Wallet */}
          {step === 1 && (
            <div
              key="step1"
              className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full space-y-6"
            >
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
                  <Wallet size={32} className="text-[var(--accent)]" />
                </div>
                <h1 className="text-2xl font-bold">{t('Welcome to Expend')}</h1>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t("Let's set up your first wallet to get started.")}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Name')}</label>
                  <input
                    ref={walletNameInputRef}
                    type="text"
                    value={walletName}
                    onChange={(e) => setWalletName(e.target.value)}
                    placeholder={t('e.g. Main Wallet')}
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('Initial Balance')}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] font-mono font-bold text-sm">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={walletBalance}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setWalletBalance(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                      }}
                      placeholder="0"
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 font-mono focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 transition-[border-color,box-shadow]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Select Categories */}
          {step === 2 && (
            <div
              key="step2"
              className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full space-y-6"
            >
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
                  <Tag size={32} className="text-[var(--accent)]" />
                </div>
                <h1 className="text-2xl font-bold">{t('Choose Categories')}</h1>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('Pick the categories you want to track. You can always add more later.')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {DEFAULT_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategories.includes(cat.nameKey);
                  return (
                    <button
                      type="button"
                      key={cat.nameKey}
                      aria-pressed={isSelected}
                      onClick={() => toggleCategory(cat.nameKey)}
                      className={cn(
                        'flex items-center gap-3 p-4 rounded-xl border text-left transition-colors',
                        isSelected
                          ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]'
                          : 'bg-[var(--card)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)]/50'
                      )}
                    >
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm font-medium flex-1">{t(cat.nameKey)}</span>
                      {isSelected && <Check size={16} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <p className="text-center text-xs text-[var(--text-secondary)]">
                {t('selected - you can skip and add later', { count: selectedCategories.length })}
              </p>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div
              key="step3"
              className="flex-1 flex flex-col justify-center items-center max-w-md mx-auto w-full space-y-6 text-center"
            >
              <div
              >
                <div className="w-20 h-20 mx-auto rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
                  <Sparkles size={40} className="text-[var(--accent)]" />
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold">{t("You're All Set!")}</h1>
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('is ready with {{count}} categories. Start tracking your expenses now.', { wallet: walletName || t('Wallet'), count: selectedCategories.length })}
                </p>
              </div>

              <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)] w-full space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">{t('Wallet')}</span>
                  <span className="font-semibold">{walletName || t('Wallet')}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">{t('Categories')}</span>
                  <span className="font-semibold">{selectedCategories.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">{t('Balance')}</span>
                  <span className="font-mono font-semibold">
                    Rp {walletBalance || '0'}
                  </span>
                </div>
              </div>

              <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-left dark:border-amber-800 dark:bg-amber-900/20">
                <div className="flex items-start gap-3">
                  <Info size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                      {t('Local-first security note')}
                    </p>
                    <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                      {t('Security Disclosure')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      </div>

      {/* Bottom Navigation */}
      <div className="p-6 pb-10 flex gap-3" style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}>
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep(s => s - 1)}
            className="flex-1 h-12 rounded-xl border border-[var(--border)] font-medium flex items-center justify-center gap-2 hover:bg-[var(--card)] transition-colors"
          >
            <ArrowLeft size={18} />            {t('Back')}
          </button>
        )}
        {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              className="flex-1 h-12 rounded-xl bg-[var(--accent)] text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-colors active:scale-95"
            >
              {t('Next')}
              <ArrowRight size={18} />
            </button>
        ) : (
          <button
            type="button"
            onClick={handleFinish}
            disabled={isSubmitting}
            className="flex-1 h-12 rounded-xl bg-[var(--accent)] text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-colors active:scale-95 disabled:opacity-50"
          >
            <Sparkles size={18} />
            {isSubmitting ? t('Setting up...') : t('Start Tracking')}
          </button>
        )}
      </div>
    </div>
  );
}
