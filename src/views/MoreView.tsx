import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChartPie, Handshake, ShoppingBag, Tag, Repeat,
  Database, ArrowSwapHorizontal, Monitor, Globe, Lock, EyeOff,
  Information, Heart, Code2, Bug, ChevronRight,
} from 'reicon-react';
import { MORE_SECTIONS, type MoreLink } from '../components/moreSections';
import { TRAKTEER_URL, SOURCE_CODE_URL, ISSUES_URL } from '../services/supportService';
import { PageHeader } from '../components/PageHeader';

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  stats: ChartPie,
  debts: Handshake,
  payees: ShoppingBag,
  categories: Tag,
  schedules: Repeat,
  backup: Database,
  importExport: ArrowSwapHorizontal,
  appearance: Monitor,
  language: Globe,
  appLock: Lock,
  privacy: EyeOff,
  about: Information,
  support: Heart,
  source: Code2,
  issues: Bug,
};

const HREF_OVERRIDES: Record<string, string> = {
  support: TRAKTEER_URL,
  source: SOURCE_CODE_URL,
  issues: ISSUES_URL,
};

function Row({ link }: { readonly link: MoreLink }) {
  const { t } = useTranslation();
  const Icon = ICONS[link.key]!;
  const content = (
    <div className="flex items-center gap-3 p-4 min-h-[56px] transition-colors hover:bg-[var(--bg)]">
      <Icon size={20} className="shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-[var(--text-primary)]">{t(link.labelKey)}</span>
        {link.descKey && <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{t(link.descKey)}</p>}
      </div>
      <ChevronRight size={16} className="text-[var(--text-secondary)] shrink-0" aria-hidden="true" />
    </div>
  );

  if (link.to) {
    return <Link to={link.to} className="block border-b border-[var(--border)] last:border-b-0 min-h-[44px]">{content}</Link>;
  }
  const href = link.href ? HREF_OVERRIDES[link.key] ?? link.href : HREF_OVERRIDES[link.key];
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block border-b border-[var(--border)] last:border-b-0 min-h-[44px]">
      {content}
    </a>
  );
}

export default function MoreView() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <PageHeader title={t('More')} />

      {MORE_SECTIONS.map(section => (
        <section key={section.key} aria-labelledby={`more-${section.key}`}>
          <h2 id={`more-${section.key}`} className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider px-1 pt-2 pb-1">
            {t(section.titleKey)}
          </h2>
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)]">
            {section.links.map(link => (
              <Row key={link.key} link={link} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
