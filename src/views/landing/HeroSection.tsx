import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Github } from 'lucide-react';

export function HeroSection({ onTryWeb, onEnter, onScrollToInstall, onScrollToFeatures }: {
  onTryWeb: () => void;
  onEnter?: () => void;
  onScrollToInstall: () => void;
  onScrollToFeatures: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.9]);
  const y = useTransform(scrollYProgress, [0, 0.2], [0, -50]);

  return (
    <section ref={ref} className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 relative overflow-hidden pt-20 pb-28 sm:pb-32">
      <motion.div style={{ opacity, scale, y }} className="text-center z-10 w-full max-w-5xl">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6 sm:mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs sm:text-sm text-white/70">{t('landing.badge')}</span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl sm:text-7xl md:text-9xl font-black tracking-tighter mb-4 sm:mb-6 bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent px-4"
        >
          Expend
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 1 }}
          className="text-base sm:text-lg md:text-2xl text-[#94A3B8] max-w-2xl mx-auto mb-8 sm:mb-12 font-light leading-relaxed px-4"
        >
          {t('landing.tagline')}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4 mb-4 sm:mb-6"
        >
          <button
            onClick={onEnter}
            className="w-full sm:w-auto px-8 sm:px-10 py-3.5 sm:py-4 bg-[var(--accent)] text-white rounded-full font-bold text-base sm:text-lg hover:bg-[var(--accent)]/90 transition-all active:scale-95 shadow-lg shadow-[var(--accent)]/30 cursor-pointer"
          >
            {t('landing.startTracking')}
          </button>
          <button
            onClick={onTryWeb}
            className="w-full sm:w-auto px-8 sm:px-10 py-3.5 sm:py-4 bg-white/10 border border-white/20 text-white rounded-full font-semibold text-base sm:text-lg hover:bg-white/15 transition-all active:scale-95 cursor-pointer"
          >
            {t('landing.tryWithoutSetup')}
          </button>
          <button
            onClick={onScrollToInstall}
            className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-transparent border border-white/10 text-white/70 rounded-full font-medium text-sm sm:text-base hover:text-white hover:border-white/30 transition-all cursor-pointer"
          >
            {t('Install App')}
          </button>
        </motion.div>

        {/* Explanatory Copy */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] sm:text-xs text-white/40 px-4 mb-8 sm:mb-12"
        >
          <span>{t('Data stored locally on this device.')}</span>
          <span className="hidden sm:inline">·</span>
          <span>{t('No account required')}</span>
          <span className="hidden sm:inline">·</span>
          <span>{t('Install for app-like experience')}</span>
        </motion.div>

        {/* GitHub Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
        >
          <a
            href="https://github.com/eiaiproject/Expend.git"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors text-sm cursor-pointer"
          >
            <Github size={16} />
            <span>{t('landing.source')}</span>
            <span className="text-white/30">|</span>
            <span>{t('landing.openSource')}</span>
          </a>
        </motion.div>
      </motion.div>

      {/* App Preview Mockup */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mt-8 sm:mt-12 w-full max-w-sm sm:max-w-md"
      >
        <div className="relative">
          {/* Phone Frame */}
          <div className="relative bg-[#1E293B] rounded-[2.5rem] sm:rounded-[3rem] p-3 sm:p-4 shadow-2xl shadow-black/50 border border-white/10">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 sm:w-40 h-6 sm:h-7 bg-[#1E293B] rounded-b-2xl z-20" />
            
            {/* Screen */}
            <div className="bg-[#0F172A] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden">
              {/* Status Bar */}
              <div className="h-10 sm:h-12 flex items-center justify-between px-6 sm:px-8 pt-2">
                <span className="text-[10px] sm:text-xs text-white/60 font-medium">9:41</span>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <div className="w-3 sm:w-4 h-2 sm:h-2.5 bg-white/60 rounded-sm" />
                  <div className="w-3 sm:w-4 h-2 sm:h-2.5 bg-white/60 rounded-sm" />
                  <div className="w-4 sm:w-5 h-2 sm:h-2.5 bg-white/60 rounded-sm" />
                </div>
              </div>

              {/* App Content */}
              <div className="px-4 sm:px-5 pb-6 sm:pb-8">
                {/* Header */}
                <div className="flex justify-between items-center mb-4 sm:mb-6 mt-2">
                  <div>
                    <h3 className="text-lg sm:text-xl font-black tracking-tighter uppercase text-white">Expend</h3>
                    <p className="text-[10px] sm:text-xs text-white/50">29 May 2024</p>
                  </div>
                </div>

                {/* Balance Card */}
                <div className="bg-[var(--accent)] rounded-2xl sm:rounded-3xl p-4 sm:p-5 mb-4 sm:mb-5">
                  <p className="text-white/80 text-[10px] sm:text-xs font-medium mb-1">Balance</p>
                  <p className="text-xl sm:text-2xl font-bold text-white font-mono">Rp 5.240.000</p>
                  <div className="flex gap-2 mt-3 sm:mt-4">
                    <div className="flex-1 bg-white/10 rounded-lg sm:rounded-xl p-2 sm:p-2.5">
                      <p className="text-[8px] sm:text-[9px] text-white/60 uppercase font-bold">Today</p>
                      <p className="text-xs sm:text-sm font-bold text-white font-mono">Rp 150.000</p>
                    </div>
                    <div className="flex-1 bg-white/10 rounded-lg sm:rounded-xl p-2 sm:p-2.5">
                      <p className="text-[8px] sm:text-[9px] text-white/60 uppercase font-bold">Yesterday</p>
                      <p className="text-xs sm:text-sm font-bold text-white font-mono">Rp 85.000</p>
                    </div>
                  </div>
                </div>

                {/* Transaction Items */}
                <div className="space-y-2 sm:space-y-2.5">
                  {[
                    { name: 'Lunch at Warung', amount: '45.000', time: '12:30', color: 'bg-red-400' },
                    { name: 'Grab to Office', amount: '25.000', time: '08:15', color: 'bg-orange-400' },
                    { name: 'Coffee Bean', amount: '35.000', time: 'Yesterday', color: 'bg-amber-400' },
                  ].map((tx, i) => (
                    <div key={i} className="bg-[#1E293B] rounded-xl sm:rounded-2xl p-3 sm:p-3.5 flex items-center gap-3">
                      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full ${tx.color} flex items-center justify-center`}>
                        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-white/80 rounded-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-white truncate">{tx.name}</p>
                        <p className="text-[10px] sm:text-xs text-white/40">{tx.time}</p>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-red-400 font-mono">-{tx.amount}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Glow Effect */}
          <div className="absolute -inset-10 bg-[var(--accent)]/20 blur-[60px] sm:blur-[80px] rounded-full -z-10" />
        </div>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="relative z-10 mt-12 sm:mt-16"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="flex flex-col items-center gap-2 cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
          onClick={onScrollToFeatures}
        >
          <span className="text-[10px] sm:text-xs text-white/60 uppercase tracking-widest">{t('landing.scrollDown')}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/60">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </motion.div>
      </motion.div>

      {/* Background Effects */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-[var(--accent)]/10 blur-[100px] sm:blur-[150px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-blue-500/10 blur-[100px] sm:blur-[150px] rounded-full" />
      </div>
    </section>
  );
}
