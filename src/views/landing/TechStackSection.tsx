import { useTranslation } from 'react-i18next';
import { type ReactNode } from 'react';
import { Code2, Smartphone, Database, Shield, BarChart3, Zap, Github } from 'lucide-react';

interface TechItem {
  icon: ReactNode;
  name: string;
  description: string;
  color: string;
}

function TechCard({ icon, name, description, color, index }: TechItem & { index: number }) {
  return (
    <div
      className="group h-full"
    >
      <div className="flex h-full items-start gap-4 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-[var(--surface)]/30 border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] transition-colors duration-300">
        <div
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${color} group-hover:scale-110 transition-transform duration-300`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] mb-1">{name}</h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

export function TechStackSection() {
  const { t } = useTranslation();

  const techStack: TechItem[] = [
    {
      icon: <Code2 size={20} className="text-[var(--text-primary)]" />,
      name: t('landing.techReact'),
      description: t('landing.techReactDesc'),
      color: 'bg-[var(--accent)]/15',
    },
    {
      icon: <Smartphone size={20} className="text-[var(--text-primary)]" />,
      name: t('landing.techPwa'),
      description: t('landing.techPwaDesc'),
      color: 'bg-[var(--accent)]/15',
    },
    {
      icon: <Database size={20} className="text-[var(--text-primary)]" />,
      name: t('landing.techDatabase'),
      description: t('landing.techDatabaseDesc'),
      color: 'bg-[var(--accent)]/15',
    },
    {
      icon: <Shield size={20} className="text-[var(--text-primary)]" />,
      name: t('landing.techSecurity'),
      description: t('landing.techSecurityDesc'),
      color: 'bg-[var(--accent)]/15',
    },
    {
      icon: <BarChart3 size={20} className="text-[var(--text-primary)]" />,
      name: t('landing.techCharts'),
      description: t('landing.techChartsDesc'),
      color: 'bg-[var(--accent)]/15',
    },
    {
      icon: <Zap size={20} className="text-[var(--text-primary)]" />,
      name: t('landing.techBuild'),
      description: t('landing.techBuildDesc'),
      color: 'bg-[var(--accent)]/15',
    },
  ];

  return (
    <section className="py-20 sm:py-28 px-4 sm:px-6 max-w-5xl mx-auto relative z-10">
      {/* Section Header */}
      <div
      className="text-center mb-12 sm:mb-16"
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[var(--text-primary)] mb-4 text-balance">
          {t('landing.techTitle')}
        </h2>
        <p className="text-base sm:text-lg text-[var(--text-muted)] max-w-2xl mx-auto text-pretty">
          {t('landing.techSubtitle')}
        </p>
      </div>

      {/* Tech Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {techStack.map((tech, i) => (
          <TechCard key={i} {...tech} index={i} />
        ))}
      </div>

      {/* GitHub CTA */}
      <div
      className="mt-10 sm:mt-12 text-center"
      >
        <a
          href="https://github.com/eiaiproject/Expend.git"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-full text-[var(--text-primary)] font-semibold hover:bg-[var(--surface-elevated)] transition-colors duration-300 group"
        >
          <Github size={20} aria-hidden="true" />
          <span>{t('landing.viewSource')}</span>
          <span className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">
            →
          </span>
        </a>
      </div>
    </section>
  );
}
