import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useRef, useState } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useFocusTrap } from '../../src/utils/focusTrap';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * onClose dibuat baru di tiap render - persis pola callback inline di view
 * (`onClose={() => setEditing(null)}`). Bug lama: `onClose` ikut masuk dependency
 * array padahal handler sudah lewat ref, sehingga effect teardown + re-run di
 * setiap render: cleanup mengembalikan fokus KE LUAR dialog lalu fokus ditarik
 * paksa ke elemen pertama.
 */
function Dialog() {
  const ref = useRef<HTMLDivElement>(null);
  const [, bump] = useState(0);
  useFocusTrap(ref, { onClose: () => bump((v) => v + 1) });
  return (
    <div ref={ref}>
      <button id="in-first" onClick={() => bump((v) => v + 1)}>first</button>
      <button id="in-target">target</button>
    </div>
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
});

describe('useFocusTrap', () => {
  it('fokus awal dipindah ke elemen pertama di dalam dialog', () => {
    act(() => {
      root.render(<Dialog />);
    });
    expect(document.activeElement?.id).toBe('in-first');
  });

  it('re-render (onClose berganti identitas) tidak merampas fokus', () => {
    act(() => {
      root.render(
        <>
          <button id="outside">outside</button>
          <Dialog />
        </>,
      );
    });
    expect(document.activeElement?.id).toBe('in-first');

    // Fokus dipindah user ke tombol kedua.
    const target = document.getElementById('in-target')!;
    act(() => target.focus());
    expect(document.activeElement?.id).toBe('in-target');

    // Interaksi memicu re-render → onClose baru. Fokus TIDAK boleh meloncat.
    act(() => {
      document.getElementById('in-first')!.click();
    });
    expect(document.activeElement?.id).toBe('in-target');
  });
});

/**
 * Meniru HomeView → EditSheet: `onClose` inline (`() => setEditing(null)`)
 * sehingga identitasnya berubah di setiap render HomeView.
 *
 * Render itu PASTI terjadi saat keyboard Android terbuka: `useVisualViewport`
 * di App.tsx menyetel state dari event `visualViewport` resize DAN `focusin`,
 * jadi menyentuh input memicu re-render Shell → HomeView → EditSheet. Selama
 * `onClose` ada di dependency array, focus trap ikut re-run dan menarik kursor
 * kembali ke field pertama - itulah keluhan "tidak bisa pindah kursor ke row
 * lain saat keyboard muncul".
 */
function EditSheetLike({ onClose }: { readonly onClose: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  useFocusTrap(formRef, { onClose, initialFocusRef: firstRef });
  return (
    <form ref={formRef}>
      <input ref={firstRef} id="desc" defaultValue="Kopi" />
      <input id="amount" defaultValue="50000" />
      <input id="note" />
    </form>
  );
}

function HomeLike() {
  // State "viewport" yang berubah saat keyboard terbuka → memaksa re-render.
  const [, setViewportTick] = useState(0);
  return (
    <div>
      <button id="viewport-resize" onClick={() => setViewportTick((v) => v + 1)}>
        keyboard terbuka
      </button>
      <EditSheetLike onClose={() => {}} />
    </div>
  );
}

describe('EditSheet + keyboard Android (regresi kursor tidak bisa pindah)', () => {
  it('fokus tetap di field yang disentuh walau induk re-render saat keyboard terbuka', () => {
    act(() => {
      root.render(<HomeLike />);
    });
    // Fokus awal otomatis ke field pertama (seperti EditSheet).
    expect(document.activeElement?.id).toBe('desc');

    // User menyentuh field kedua → keyboard naik.
    const amount = document.getElementById('amount')!;
    act(() => amount.focus());
    expect(document.activeElement?.id).toBe('amount');

    // Event visualViewport (keyboard terbuka) → Shell/HomeView re-render.
    act(() => {
      document.getElementById('viewport-resize')!.click();
    });

    // Tanpa perbaikan: fokus ditarik kembali ke "desc" (field pertama).
    expect(document.activeElement?.id).toBe('amount');
  });

  it('fokus tetap di field ketiga setelah dua kali re-render', () => {
    act(() => {
      root.render(<HomeLike />);
    });
    const note = document.getElementById('note')!;
    act(() => note.focus());
    act(() => {
      document.getElementById('viewport-resize')!.click();
    });
    act(() => {
      document.getElementById('viewport-resize')!.click();
    });
    expect(document.activeElement?.id).toBe('note');
  });
});
