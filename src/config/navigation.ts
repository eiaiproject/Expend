import { Home, ChatRoundDots, Setting } from 'reicon-react';
import type { ComponentType, SVGProps } from 'react';
import type { TranslationKey } from '../i18n/id';

interface NavItem {
  labelKey: TranslationKey;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
}

export const navigationItems: readonly NavItem[] = [
  { labelKey: 'nav.summary', href: '/', icon: Home },
  { labelKey: 'nav.record', href: '/chat', icon: ChatRoundDots },
  { labelKey: 'nav.settings', href: '/settings', icon: Setting },
];

/** Custom active check so /chat?mode=upload still highlights Chat. */
export function isActivePath(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}
