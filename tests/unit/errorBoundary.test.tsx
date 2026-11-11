import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from '../../src/i18n';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Boom(): never {
  throw new Error('boom');
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('menampilkan fallback dan tidak membiarkan layar putih', () => {
    act(() => {
      root.render(
        <I18nProvider>
          <ErrorBoundary>
            <Boom />
          </ErrorBoundary>
        </I18nProvider>,
      );
    });

    const fallback = container.querySelector('[data-testid="error-boundary"]');
    expect(fallback).not.toBeNull();
    expect(container.textContent).toContain('Terjadi kesalahan');
    expect(container.textContent).toContain('Muat ulang');
    expect(container.textContent).toContain('Buka Pengaturan');
  });

  it('merender anak normal saat tidak ada error', () => {
    act(() => {
      root.render(
        <I18nProvider>
          <ErrorBoundary>
            <p>aman</p>
          </ErrorBoundary>
        </I18nProvider>,
      );
    });
    expect(container.textContent).toBe('aman');
  });
});
