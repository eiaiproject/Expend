import { Home, ChatRoundDots, Setting } from 'reicon-react';
import type { ComponentType, SVGProps } from 'react';
import type { TranslationKey } from '../i18n/id';

export interface NavItem {
  labelKey: TranslationKey;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
}

export const navigationItems: NavItem[] = [
  { labelKey: 'nav.summary', href: '/', icon: Home },
  { labelKey: 'nav.record', href: '/chat', icon: ChatRoundDots },
  { labelKey: 'nav.settings', href: '/settings', icon: Setting },
];
