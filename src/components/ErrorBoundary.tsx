import React, { ErrorInfo, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }

    return (this.props as Props).children;
  }
}

function ErrorFallback() {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[var(--bg)] text-[var(--text-primary)]">
      <div className="bg-red-500/10 p-4 rounded-full text-red-500 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <h2 className="text-xl font-bold mb-2">{t('Error Title')}</h2>
      <p className="text-[var(--text-secondary)] mb-6 max-w-xs">
      {t('Error Message')}
    </p>
      <button type="button" 
        onClick={() => window.location.reload()}
        className="px-6 py-2 bg-[var(--accent-fill)] text-[var(--accent-ink)] rounded-lg font-medium active:scale-95 transition-colors"
      >
        {t('Error Reload')}
      </button>
    </div>
  );
}
