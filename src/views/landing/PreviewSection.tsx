import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { BarChart3, PieChart, Wallet, TrendingUp, Search, Tags } from 'lucide-react';

interface PreviewCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  mockup: React.ReactNode;
  index: number;
}

function PreviewCard({ icon, title, description, mockup, index }: PreviewCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, delay: index * 0.15 }}
      className="group"
    >
      <div className="h-full bg-[var(--surface)]/50 border border-[var(--border-subtle)] rounded-xl sm:rounded-2xl overflow-hidden hover:border-[var(--accent)]/20 transition-all duration-500 flex flex-col">
        {/* Mockup Area */}
        <div className="relative bg-[var(--bg)] p-4 sm:p-6 flex-1 flex items-start justify-center overflow-hidden">
          {mockup}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--card)]/80 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 mt-auto h-[144px] sm:h-[156px] flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              {icon}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">{title}</h3>
          </div>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-2 pl-[52px]">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}

function DashboardMockup() {
  return (
    <div className="w-full max-w-[280px] space-y-3">
      {/* Balance Card */}
      <div className="bg-[var(--accent)] rounded-2xl p-4">
        <p className="text-white/70 text-[10px] font-medium mb-1">Balance</p>
        <p className="text-xl font-bold text-white font-mono">Rp 5.240.000</p>
        <div className="flex gap-2 mt-3">
          <div className="flex-1 bg-white/10 rounded-lg p-2">
            <p className="text-[8px] text-white/60 uppercase font-bold">Today</p>
            <p className="text-xs font-bold text-white font-mono">Rp 150.000</p>
          </div>
          <div className="flex-1 bg-white/10 rounded-lg p-2">
            <p className="text-[8px] text-white/60 uppercase font-bold">Yesterday</p>
            <p className="text-xs font-bold text-white font-mono">Rp 85.000</p>
          </div>
        </div>
      </div>
      {/* Insight */}
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
          <TrendingUp size={14} className="text-red-400" />
        </div>
        <div>
          <p className="text-[10px] text-red-400 font-medium">Spending up</p>
          <p className="text-[9px] text-white/50">+23% vs yesterday</p>
        </div>
      </div>
      {/* Quick Transactions */}
      <div className="space-y-2">
        {['Lunch', 'Grab', 'Coffee'].map((name, i) => (
          <div key={i} className="bg-[var(--card)] rounded-xl p-2.5 flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${i === 0 ? 'bg-red-400' : i === 1 ? 'bg-orange-400' : 'bg-amber-400'}`}>
              <div className="w-2 h-2 bg-white/80 rounded-full" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-medium text-white">{name}</p>
            </div>
            <p className="text-[10px] font-bold text-red-400 font-mono">-{(45 - i * 10).toString()},000</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsMockup() {
  return (
    <div className="w-full max-w-[280px] space-y-3">
      {/* Pie Chart Mockup */}
      <div className="bg-[var(--card)] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold text-white">Spending by Category</p>
          <PieChart size={14} className="text-[var(--accent)]" />
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="#EF4444" strokeWidth="3" strokeDasharray="40 60" />
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="#F97316" strokeWidth="3" strokeDasharray="25 75" strokeDashoffset="-40" />
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="#EAB308" strokeWidth="3" strokeDasharray="20 80" strokeDashoffset="-65" />
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="15 85" strokeDashoffset="-85" />
            </svg>
          </div>
          <div className="space-y-2 flex-1">
            {[
              { name: 'Food', pct: '40%', color: 'bg-red-400' },
              { name: 'Transport', pct: '25%', color: 'bg-orange-400' },
              { name: 'Shopping', pct: '20%', color: 'bg-amber-400' },
              { name: 'Other', pct: '15%', color: 'bg-[var(--accent)]' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${item.color}`} />
                <span className="text-[9px] text-white/60 flex-1">{item.name}</span>
                <span className="text-[9px] font-bold text-white">{item.pct}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Bar Chart Mockup */}
      <div className="bg-[var(--card)] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold text-white">Monthly Comparison</p>
          <BarChart3 size={14} className="text-[var(--accent)]" />
        </div>
        <div className="flex items-end gap-1.5 h-16">
          {[40, 55, 35, 70, 45, 80, 60, 50, 75, 65, 85, 45].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full rounded-t ${i === 10 ? 'bg-[var(--accent)]' : 'bg-[var(--accent)]/30'}`}
                style={{ height: `${h}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[8px] text-white/40">Jan</span>
          <span className="text-[8px] text-white/40">Dec</span>
        </div>
      </div>
    </div>
  );
}

function WalletMockup() {
  return (
    <div className="w-full max-w-[280px] space-y-3">
      {[
        { name: 'Main Wallet', balance: 'Rp 3.500.000', change: '+Rp 250.000', icon: 'W', trend: 'up' },
        { name: 'Savings', balance: 'Rp 1.240.000', change: '+Rp 100.000', icon: 'S', trend: 'up' },
        { name: 'Cash', balance: 'Rp 500.000', change: '-Rp 50.000', icon: 'C', trend: 'down' },
      ].map((wallet, i) => (
        <div key={i} className="bg-[var(--card)] rounded-2xl p-4 flex items-center gap-3 hover:border-[var(--accent)]/20 border border-transparent transition-all">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-sm font-bold text-[var(--accent)]">
            {wallet.icon}
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-white">{wallet.name}</p>
            <p className="text-[10px] text-white/50 mt-0.5">
              <span className={wallet.trend === 'up' ? 'text-green-400' : 'text-red-400'}>
                {wallet.change}
              </span>
              {' '}this month
            </p>
          </div>
          <p className="text-sm font-bold text-white font-mono">{wallet.balance}</p>
        </div>
      ))}
    </div>
  );
}

export function PreviewSection() {
  const { t } = useTranslation();

  const previews: PreviewCardProps[] = [
    {
      icon: <Wallet size={18} className="text-[var(--accent)]" />,
      title: t('landing.previewDashboard'),
      description: t('landing.previewDashboardDesc'),
      mockup: <DashboardMockup />,
      index: 0,
    },
    {
      icon: <BarChart3 size={18} className="text-[var(--accent)]" />,
      title: t('landing.previewStats'),
      description: t('landing.previewStatsDesc'),
      mockup: <StatsMockup />,
      index: 1,
    },
    {
      icon: <Tags size={18} className="text-[var(--accent)]" />,
      title: t('landing.previewWallet'),
      description: t('landing.previewWalletDesc'),
      mockup: <WalletMockup />,
      index: 2,
    },
  ];

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 max-w-6xl mx-auto relative z-10">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12 sm:mb-16"
        id="preview-section"
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)] mb-4">
          {t('landing.previewTitle')}
        </h2>
        <p className="text-base sm:text-lg text-[var(--text-muted)] max-w-2xl mx-auto">
          {t('landing.previewSubtitle')}
        </p>
      </motion.div>

      {/* Preview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
        {previews.map((preview, i) => (
          <PreviewCard key={i} {...preview} />
        ))}
      </div>
    </section>
  );
}
