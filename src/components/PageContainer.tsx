import type { ReactNode } from 'react';

interface PageContainerProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {children}
    </div>
  );
}
