import { useTranslation } from 'react-i18next';
import { Lock, Globe, Code, CreditCard, CheckCircle2, Zap, Shield, Wifi } from 'lucide-react';

export function SocialProofSection() {
  const { t } = useTranslation();

  const proofs = [
    {
      icon: <Lock size={18} className="text-[var(--accent)]" />,
      label: t('landing.proof1Label'),
      value: t('landing.proof1Value'),
    },
    {
      icon: <Globe size={18} className="text-[var(--accent)]" />,
      label: t('landing.proof2Label'),
      value: t('landing.proof2Value'),
    },
    {
      icon: <Code size={18} className="text-[var(--accent)]" />,
      label: t('landing.proof3Label'),
      value: t('landing.proof3Value'),
    },
    {
      icon: <CreditCard size={18} className="text-[var(--accent)]" />,
      label: t('landing.proof4Label'),
      value: t('landing.proof4Value'),
    },
  ];

  const highlights = [
    {
      icon: <CheckCircle2 size={16} className="text-green-400" />,
      text: t('landing.highlightNoRegistration'),
    },
    {
      icon: <Zap size={16} className="text-amber-400" />,
      text: t('landing.highlightInstantSetup'),
    },
    {
      icon: <Shield size={16} className="text-blue-400" />,
      text: t('landing.highlightPbkdf2'),
    },
    {
      icon: <Wifi size={16} className="text-purple-400" />,
      text: t('landing.highlightOffline'),
    },
  ];

  return (
    <section className="py-20 sm:py-28 px-4 sm:px-6 relative z-10">
      <div
        className="max-w-5xl mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)] mb-4 text-balance">
            {t('landing.trustedTitle')}
          </h2>
          <p className="text-base sm:text-lg text-[var(--text-muted)] max-w-xl mx-auto text-pretty">
            {t('landing.trustStatement')}
          </p>
        </div>

        {/* Proof Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 mb-10 sm:mb-12">
          {proofs.map((proof, i) => (
            <div key={i} className="text-center group rounded-xl border border-[var(--border-subtle)] p-4 sm:p-6">
              <div className="mb-2 sm:mb-3 text-[var(--accent)] opacity-60 group-hover:opacity-100 transition-opacity">
                {proof.icon}
              </div>
              <p className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
                {proof.value}
              </p>
              <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)] uppercase tracking-wider">
                {proof.label}
              </p>
            </div>
          ))}
        </div>

        {/* Highlight Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8">
          {highlights.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)]/30 px-3 py-1.5"
            >
              {item.icon}
              <span className="text-xs sm:text-sm font-medium text-[var(--text-primary)]">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
