import { useState } from 'react';
import { toast } from './Toaster';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, Tag, Check, ArrowRight, ArrowLeft, Sparkles, Plus } from 'lucide-react';
import { db } from '../db/db';
import { cn } from '../utils/cn';
import { CURATED_PALETTE, DEFAULT_CATEGORIES } from '../utils/constants';

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

  const toggleCategory = (name: string) => {
    setSelectedCategories(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      // Create wallet
      if (walletName.trim()) {
        await db.wallets.add({
          name: walletName.trim(),
          currency: 'IDR',
          initialBalance: parseInt(walletBalance.replace(/[^0-9]/g, '') || '0', 10),
          lastUpdated: new Date().toISOString(),
        });
      }

      const existingColors = await db.categories.toArray().then(cats => new Set(cats.map(c => c.color)));
      for (const catName of selectedCategories) {
        const cat = DEFAULT_CATEGORIES.find(c => c.name === catName);
        const availableColors = [...CURATED_PALETTE].filter(c => !existingColors.has(c));
        const fallbackColor = (availableColors[Math.floor(Math.random() * availableColors.length)]
          ?? CURATED_PALETTE[Math.floor(Math.random() * CURATED_PALETTE.length)])!;
        const color: string = cat?.color ?? fallbackColor;

        existingColors.add(color);

        await db.categories.add({
          name: catName,
          icon: '🏷️',
          color: color,
        });
      }

      localStorage.setItem('expend_onboarding_completed', 'true');
      onComplete();
    } catch (err) {
      console.error('Onboarding failed:', err);
      // Don't auto-complete — let user retry instead of getting stuck without data
      toast.add(t('Onboarding failed. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepVariants = {
    enter: { opacity: 0, x: 40 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] bg-[var(--bg)] flex flex-col"
    >
      {/* Progress Bar */}
      <div className="flex gap-1.5 p-4 pt-8">
        {[1, 2, 3].map(s => (
          <div
            key={s}
            className={cn(
              'flex-1 h-1 rounded-full transition-all duration-500',
              s <= step ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
            )}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col px-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* Step 1: Create Wallet */}
          {step === 1 && (
            <motion.div
              key="step1"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
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
                    type="text"
                    value={walletName}
                    onChange={(e) => setWalletName(e.target.value)}
                    placeholder={t('e.g. Main Wallet')}
                    className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl px-4 py-3 focus:outline-none focus:border-[var(--accent)]"
                    autoFocus
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
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 font-mono focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Select Categories */}
          {step === 2 && (
            <motion.div
              key="step2"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
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
                  const isSelected = selectedCategories.includes(cat.name);
                  return (
                    <button
                      key={cat.name}
                      onClick={() => toggleCategory(cat.name)}
                      className={cn(
                        'flex items-center gap-3 p-4 rounded-xl border text-left transition-all',
                        isSelected
                          ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]'
                          : 'bg-[var(--card)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)]/50'
                      )}
                    >
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm font-medium flex-1">{cat.name}</span>
                      {isSelected && <Check size={16} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <p className="text-center text-xs text-[var(--text-secondary)]">
                {t('selected - you can skip and add later', { count: selectedCategories.length })}
              </p>
            </motion.div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <motion.div
              key="step3"
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="flex-1 flex flex-col justify-center items-center max-w-md mx-auto w-full space-y-6 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.2 }}
              >
                <div className="w-20 h-20 mx-auto rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
                  <Sparkles size={40} className="text-[var(--accent)]" />
                </div>
              </motion.div>

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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <div className="p-6 pb-10 flex gap-3">
        {step > 1 && (
          <button
            onClick={() => setStep(s => s - 1)}
            className="flex-1 h-12 rounded-xl border border-[var(--border)] font-medium flex items-center justify-center gap-2 hover:bg-[var(--card)] transition-colors"
          >
            <ArrowLeft size={18} />            {t('Back')}
          </button>
        )}
        {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex-1 h-12 rounded-xl bg-[var(--accent)] text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95"
            >
              {t('Next')}
              <ArrowRight size={18} />
            </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={isSubmitting}
            className="flex-1 h-12 rounded-xl bg-[var(--accent)] text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
          >
            <Sparkles size={18} />
            {isSubmitting ? t('Setting up...') : t('Start Tracking')}
          </button>
        )}
      </div>
    </motion.div>
  );
}
