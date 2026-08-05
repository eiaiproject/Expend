/**
 * More-page group definitions (master.md §3.1). Pure data so the grouping is
 * unit-testable and stays in sync with the locale files.
 * Internal routes use `to`; external links use `href` (overridden in MoreView
 * with the real supportService URLs).
 */
export interface MoreLink {
  readonly key: string;
  readonly labelKey: string;
  readonly descKey?: string;
  readonly to?: string;
  readonly href?: string;
}

export interface MoreSection {
  readonly key: string;
  readonly titleKey: string;
  readonly links: readonly MoreLink[];
}

export const MORE_SECTIONS: readonly MoreSection[] = [
  {
    key: 'finance',
    titleKey: 'more.sectionFinance',
    links: [
      { key: 'stats', labelKey: 'stats.statistics', to: '/stats' },
      { key: 'debts', labelKey: 'Debts & Receivables', to: '/debts' },
      { key: 'payees', labelKey: 'payees.pageTitle', to: '/payees' },
      { key: 'categories', labelKey: 'Categories', to: '/categories' },
      { key: 'schedules', labelKey: 'recurring.pageTitle', to: '/schedules' },
    ],
  },
  {
    key: 'data',
    titleKey: 'more.sectionData',
    links: [
      { key: 'backup', labelKey: 'more.backupRestore', descKey: 'more.backupRestoreDesc', to: '/settings' },
      { key: 'importExport', labelKey: 'more.importExport', descKey: 'more.importExportDesc', to: '/settings' },
    ],
  },
  {
    key: 'application',
    titleKey: 'more.sectionApplication',
    links: [
      { key: 'appearance', labelKey: 'more.appearance', descKey: 'more.appearanceDesc', to: '/settings' },
      { key: 'language', labelKey: 'more.language', descKey: 'more.languageDesc', to: '/settings' },
      { key: 'appLock', labelKey: 'more.appLock', descKey: 'more.appLockDesc', to: '/settings' },
      { key: 'privacy', labelKey: 'more.privacy', descKey: 'more.privacyDesc', to: '/settings' },
    ],
  },
  {
    key: 'about',
    titleKey: 'more.sectionAbout',
    links: [
      { key: 'about', labelKey: 'more.about', descKey: 'more.aboutDesc', to: '/settings' },
      { key: 'support', labelKey: 'more.supportDev', descKey: 'more.supportDevDesc', href: '' },
      { key: 'source', labelKey: 'more.sourceCode', href: '' },
      { key: 'issues', labelKey: 'more.reportIssue', href: '' },
    ],
  },
];
