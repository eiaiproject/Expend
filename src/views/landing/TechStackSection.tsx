import { useTranslation } from 'react-i18next';
import { Code2, Mobile, Database, Shield, ChartBar, Bolt, Code, ChevronDown, Link as ExternalLink } from 'reicon-react';
import { useState, useCallback } from 'react';

const techItems = [
  { icon: Code2, nameKey: 'landing.techReact', descKey: 'landing.techReactDesc' },
  { icon: Mobile, nameKey: 'landing.techPwa', descKey: 'landing.techPwaDesc' },
  { icon: Database, nameKey: 'landing.techDatabase', descKey: 'landing.techDatabaseDesc' },
  { icon: Shield, nameKey: 'landing.techSecurity', descKey: 'landing.techSecurityDesc' },
  { icon: ChartBar, nameKey: 'landing.techCharts', descKey: 'landing.techChartsDesc' },
  { icon: Bolt, nameKey: 'landing.techBuild', descKey: 'landing.techBuildDesc' },
];

export function TechStackSection() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Accordion trigger */}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          aria-controls="tech-stack-panel"
          className="w-full flex items-center justify-between gap-4 py-4 border-t border-[var(--border-subtle)] cursor-pointer group"
        >
          <div className="text-left">
            <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
              {t('landing.techTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
              {t('landing.techSubtitle')}
            </p>
          </div>
          <ChevronDown
            size={20}
            className={`text-[var(--text-muted)] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {/* Accordion content */}
        <section
          id="tech-stack-panel"
          aria-label={t('landing.techTitle')}
          hidden={!isOpen}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-6 pt-2">
            {techItems.map(({ icon: Icon, nameKey, descKey }, i) => (
              <div key={nameKey} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--surface)]/30">
                <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-[var(--accent)]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t(nameKey)}</h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t(descKey)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* GitHub link */}
          <div className="pb-6">
            <a
              href="https://github.com/eiaiproject/Expend.git"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"
            >
              <Code size={16} aria-hidden="true" />
              {t('landing.source', 'View Source Code')} <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </section>
      </div>
    </section>
  );
}
