import { useTranslation } from 'react-i18next';
import { ChartBar, ChartPie, Wallet, TrendUp, Tags } from 'reicon-react';

interface PreviewCardProps {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly description: string;
  readonly mockup: React.ReactNode;
  readonly index: number;
}

function PreviewCard({ icon, title, description, mockup, index }: PreviewCardProps) {
  return (
    <div
      className="group h-full"
    >
      <div className="h-full min-h-[520px] bg-[var(--surface)]/50 border border-[var(--border-subtle)] rounded-xl sm:rounded-2xl overflow-hidden hover:border-[var(--accent)]/20 transition-colors duration-500 flex flex-col">
        {/* Mockup Area — theme-locked dark on purpose (design audit): the mockups
            hardcode white text, so this area stays dark in BOTH themes or it
            becomes unreadable in light mode. */}
        <div className="relative bg-[#1A1E16] p-4 sm:p-6 h-[360px] sm:h-[380px] flex items-center justify-center overflow-hidden">
          {mockup}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#252A20]/80 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 mt-auto min-h-[156px] flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              {icon}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] text-balance">
              {title}
            </h3>
          </div>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-2 pl-[52px]">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function DashboardMockup() {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-[280px] space-y-3">
      {/* Balance Card */}
      <div className="bg-[#4A7A3A] rounded-2xl p-4">
        <p className="text-white/70 text-[10px] font-medium mb-1">{t('Balance')}</p>
        <p className="text-xl font-bold text-white font-mono">Rp 5.240.000</p>
        <div className="flex gap-2 mt-3">
          <div className="flex-1 bg-white/10 rounded-lg p-2">
            <p className="text-[8px] text-white/60 uppercase font-bold">{t('Today')}</p>
            <p className="text-xs font-bold text-white font-mono">Rp 150.000</p>
          </div>
          <div className="flex-1 bg-white/10 rounded-lg p-2">
            <p className="text-[8px] text-white/60 uppercase font-bold">{t('Yesterday')}</p>
            <p className="text-xs font-bold text-white font-mono">Rp 85.000</p>
          </div>
        </div>
      </div>
      {/* Insight */}
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
          <TrendUp size={14} className="text-red-400" />
        </div>
        <div>
          <p className="text-[10px] text-red-400 font-medium">{t('Spending up')}</p>
          <p className="text-[9px] text-white/50">{t('landing.demoVsYesterday')}</p>
        </div>
      </div>
      {/* Quick Transactions */}
      <div className="space-y-2">
        {[t('landing.demoLunchShort'), 'Grab', t('landing.demoCoffeeShort')].map((name, i) => (
          <div key={name} className="bg-[#252A20] rounded-xl p-2.5 flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center ${
                (() => {
                  if (i === 0) return 'bg-red-400';
                  if (i === 1) return 'bg-orange-400';
                  return 'bg-amber-400';
                })()
              }`}
            >
              <div className="w-2 h-2 bg-white/80 rounded-full" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-medium text-white">{name}</p>
            </div>
            <p className="text-[10px] font-bold text-red-400 font-mono">
              -{(45 - i * 10).toString()},000
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsMockup() {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-[280px] space-y-3">
      {/* Pie Chart Mockup */}
      <div className="bg-[#252A20] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold text-white">{t('Spending by Category')}</p>
          <ChartPie size={14} className="text-[#A8C49A]" />
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20" role="img" aria-label={t('landing.previewCategoryAria')}>
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90" aria-hidden="true">
              <circle
                cx="18"
                cy="18"
                r="15.915"
                fill="none"
                stroke="#EF4444"
                strokeWidth="3"
                strokeDasharray="40 60"
              />
              <circle
                cx="18"
                cy="18"
                r="15.915"
                fill="none"
                stroke="#F97316"
                strokeWidth="3"
                strokeDasharray="25 75"
                strokeDashoffset="-40"
              />
              <circle
                cx="18"
                cy="18"
                r="15.915"
                fill="none"
                stroke="#EAB308"
                strokeWidth="3"
                strokeDasharray="20 80"
                strokeDashoffset="-65"
              />
              <circle
                cx="18"
                cy="18"
                r="15.915"
                fill="none"
                stroke="#7A9B6A"
                strokeWidth="3"
                strokeDasharray="15 85"
                strokeDashoffset="-85"
              />
            </svg>
          </div>
          <div className="space-y-2 flex-1">
            {[
              { name: t('Default Category Food & Drinks'), pct: '40%', color: 'bg-red-400' },
              { name: t('Default Category Transportation'), pct: '25%', color: 'bg-orange-400' },
              { name: t('Default Category Shopping'), pct: '20%', color: 'bg-amber-400' },
              { name: t('Other'), pct: '15%', color: 'bg-[#7A9B6A]' },
            ].map((item, i) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${item.color}`} />
                <span className="text-[9px] text-white/60 flex-1">{item.name}</span>
                <span className="text-[9px] font-bold text-white">{item.pct}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Bar Chart Mockup */}
      <div className="bg-[#252A20] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-bold text-white">{t('Monthly Comparison')}</p>
          <ChartBar size={14} className="text-[#A8C49A]" />
        </div>
        <div className="flex items-end gap-1.5 h-16">
          {[40, 55, 35, 70, 45, 80, 60, 50, 75, 65, 85, 45].map((h, i) => (
            <div key={`bar-${i}`} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full rounded-t ${i === 10 ? 'bg-[#7A9B6A]' : 'bg-[#7A9B6A]/30'}`}
                style={{ height: `${h}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[8px] text-white/40">{t('landing.monthJan')}</span>
          <span className="text-[8px] text-white/40">{t('landing.monthDec')}</span>
        </div>
      </div>
    </div>
  );
}

function WalletMockup() {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-[280px] space-y-3">
      {[
        {
          name: t('Main Wallet'),
          balance: 'Rp 3.500.000',
          change: '+Rp 250.000',
          icon: 'W',
          trend: 'up',
        },
        { name: t('landing.demoSavings'), balance: 'Rp 1.240.000', change: '+Rp 100.000', icon: 'S', trend: 'up' },
        { name: t('landing.demoCash'), balance: 'Rp 500.000', change: '-Rp 50.000', icon: 'C', trend: 'down' },
      ].map((wallet, i) => (
        <div
          key={wallet.name}
          className="bg-[#252A20] rounded-2xl p-4 flex items-center gap-3 hover:border-[#7A9B6A]/20 border border-transparent transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-[#7A9B6A]/10 flex items-center justify-center text-sm font-bold text-[#A8C49A] shrink-0">
            {wallet.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white">{wallet.name}</p>
            <p className="text-[10px] text-white/50 mt-0.5">
              <span className={wallet.trend === 'up' ? 'text-green-400' : 'text-red-400'}>
                {wallet.change}
              </span>{' '}
              {t('This Month').toLowerCase()}
            </p>
          </div>
          <p className="text-sm font-bold text-white font-mono shrink-0">{wallet.balance}</p>
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
      icon: <ChartBar size={18} className="text-[var(--accent)]" />,
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
    <section
      id="preview-section"
      className="scroll-mt-24 py-20 sm:py-28 px-4 sm:px-6 max-w-6xl mx-auto relative z-10"
    >
      {/* Section Header */}
      <div
        className="text-center mb-12 sm:mb-16"
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)] mb-4 text-balance">
          {t('landing.previewTitle')}
        </h2>
        <p className="text-base sm:text-lg text-[var(--text-muted)] max-w-2xl mx-auto text-pretty">
          {t('landing.previewSubtitle')}
        </p>
      </div>

      {/* Preview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
        {previews.map((preview, i) => (
          <PreviewCard key={preview.title ?? i} {...preview} />
        ))}
      </div>
    </section>
  );
}
