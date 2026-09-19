import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from '../../src/i18n';
import { Toast } from '../../src/components/Toast';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * `key={message}` adalah pola yang dipakai view (Home/Chat/Settings). Tanpa key,
 * instance Toast tidak remount saat pesan berganti sehingga timer pesan pertama
 * tetap berjalan dan toast baru hilang lebih cepat dari `duration`-nya.
 */
function Host({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <I18nProvider>
      <Toast key={message} message={message} onDismiss={onDismiss} duration={1000} />
    </I18nProvider>
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('Toast', () => {
  it('pesan baru me-reset timer, tidak mewarisi sisa timer pesan lama', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    act(() => root.render(<Host message="Pertama" onDismiss={onDismiss} />));
    // 600ms berlalu dari 1000ms pesan pertama.
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Pesan kedua muncul; timer-nya harus mulai dari nol.
    act(() => root.render(<Host message="Kedua" onDismiss={onDismiss} />));
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Total 1200ms sejak pesan pertama, tapi pesan kedua baru berjalan 600ms.
    expect(container.textContent).toContain('Kedua');
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
