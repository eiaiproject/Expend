import { motion } from 'motion/react';
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
    <section className="py-16 sm:py-24 px-4 sm:px-6 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-5xl mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)] mb-4">
            {t('landing.trustedTitle')}
          </h2>
          <p className="text-base sm:text-lg text-[var(--text-muted)] max-w-xl mx-auto">
            {t('landing.trustStatement')}
          </p>
        </div>

        {/* Proof Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-10 sm:mb-12">
          {proofs.map((proof, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-[var(--surface)]/50 border border-[var(--border-subtle)] rounded-xl sm:rounded-2xl p-5 sm:p-6 text-center hover:border-[var(--accent)]/20 transition-all duration-300 group"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                {proof.icon}
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-1">
                {proof.value}
              </p>
              <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] uppercase tracking-wider font-medium">
                {proof.label}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Highlight Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-3 sm:gap-4"
        >
          {highlights.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[var(--surface)]/30 border border-[var(--border-subtle)] rounded-full"
            >
              {item.icon}
              <span className="text-xs sm:text-sm text-[var(--text-primary)] font-medium">{item.text}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
