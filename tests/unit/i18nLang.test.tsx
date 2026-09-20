import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider, useTranslation } from '../../src/i18n';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Switcher() {
  const { lang, setLang } = useTranslation();
  return (
    <button type="button" onClick={() => setLang(lang === 'id' ? 'en' : 'id')}>
      {lang}
    </button>
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = 'id';
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('i18n <html lang>', () => {
  it('mengikuti bahasa aktif, bukan tetap "id"', async () => {
    await act(async () => {
      root.render(
        <I18nProvider>
          <Switcher />
        </I18nProvider>,
      );
    });
    expect(document.documentElement.lang).toBe('id');

    await act(async () => {
      container.querySelector('button')!.click();
    });
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('expend_lang')).toBe('en');
  });
});
