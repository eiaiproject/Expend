import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n/shared';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly error: Error | null;
}

/**
 * Menangkap error render supaya satu baris rusak tidak membuat seluruh
 * aplikasi menjadi layar putih. Data tetap di IndexedDB; pengguna diberi
 * jalan keluar untuk memuat ulang atau mengekspor data.
 */
export class ErrorBoundary extends Component<Props, State> {
  readonly state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log lokal saja; tidak ada telemetry dan tidak ada data transaksi yang dikirim.
    console.error('[expend] render error', error, info.componentStack);
  }

  private readonly reload = () => {
    window.location.reload();
  };

  private readonly openSettings = () => {
    window.location.assign('/settings');
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-[100dvh] bg-[var(--bg)] text-[var(--text-primary)] grid place-items-center p-6" role="alert" data-testid="error-boundary">
        <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <p className="text-xs font-bold tracking-wide uppercase text-[var(--danger)]">{t('error.title')}</p>
          <h1 className="mt-2 text-xl font-bold tracking-tight">{t('error.title')}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{t('error.description')}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.reload}
              className="min-h-12 px-4 rounded-[var(--radius-md)] bg-[var(--accent-fill)] text-[var(--accent-ink)] text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
            >
              {t('error.reload')}
            </button>
            <button
              type="button"
              onClick={this.openSettings}
              className="min-h-12 px-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-sm font-semibold hover:bg-[var(--bone)] active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
            >
              {t('error.openSettings')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
