import { Home, ChatRoundDots, Setting } from 'reicon-react';
import type { ComponentType, SVGProps } from 'react';

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
}

export const navigationItems: NavItem[] = [
  { label: 'Ringkasan', href: '/', icon: Home },
  { label: 'Catat', href: '/chat', icon: ChatRoundDots },
  { label: 'Pengaturan', href: '/settings', icon: Setting },
];
