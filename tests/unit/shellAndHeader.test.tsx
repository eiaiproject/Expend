import { describe, expect, it } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { BottomSheetShell } from '../../src/components/BottomSheetShell';
import { PageHeader } from '../../src/components/PageHeader';

function render(el: React.ReactElement): { root: Root; container: HTMLDivElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(el); });
  return { root, container };
}

describe('BottomSheetShell', () => {
  it('maps size variants to sheet-height classes', () => {
    const { root, container } = render(
      <BottomSheetShell isOpen onClose={() => {}} title="t">
        <p>body</p>
      </BottomSheetShell>,
    );
    act(() => { root.render(
      <BottomSheetShell isOpen size="medium" onClose={() => {}} title="t">
        <p>body</p>
      </BottomSheetShell>,
    ); });
    expect(container.querySelector('dialog')!.className).toContain('sheet-height-medium');

    act(() => { root.render(
      <BottomSheetShell isOpen size="full" onClose={() => {}} title="t">
        <p>body</p>
      </BottomSheetShell>,
    ); });
    expect(container.querySelector('dialog')!.className).toContain('sheet-height-full');

    act(() => { root.render(
      <BottomSheetShell isOpen size="content" onClose={() => {}} title="t">
        <p>body</p>
      </BottomSheetShell>,
    ); });
    expect(container.querySelector('dialog')!.className).toContain('sheet-height-content');

    act(() => { root.unmount(); });
  });

  it('renders sticky footer above the scrollable body', () => {
    const { root, container } = render(
      <BottomSheetShell isOpen onClose={() => {}} title="t" footer={<button type="button">Save</button>}>
        <p>body</p>
      </BottomSheetShell>,
    );
    const dialog = container.querySelector('dialog')!;
    const footer = [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Save')!;
    expect(footer.textContent).toBe('Save');
    // Footer must not be inside the scrollable region.
    expect(footer.closest('.overflow-y-auto')).toBeNull();
    act(() => { root.unmount(); });
  });

  it('renders a clickable backdrop that calls onClose', () => {
    let closed = 0;
    const { root, container } = render(
      <BottomSheetShell isOpen onClose={() => { closed++; }} title="t">
        <p>body</p>
      </BottomSheetShell>,
    );
    const backdrop = container.querySelector('.fixed.inset-0')!;
    act(() => { backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(closed).toBe(1);
    act(() => { root.unmount(); });
  });
});

describe('PageHeader', () => {
  it('renders a single H1 with optional description', () => {
    const { root, container } = render(<PageHeader title="Wallets" description="Total balance" />);
    const h1 = container.querySelector('h1')!;
    expect(h1.textContent).toBe('Wallets');
    expect(container.textContent).toContain('Total balance');
    act(() => { root.unmount(); });
  });

  it('renders a labeled back button when onBack is provided', () => {
    let wentBack = false;
    const { root, container } = render(
      <PageHeader title="Detail" onBack={() => { wentBack = true; }} backLabel="Back to list" />,
    );
    const back = container.querySelector('button')!;
    expect(back.getAttribute('aria-label')).toBe('Back to list');
    act(() => { back.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(wentBack).toBe(true);
    act(() => { root.unmount(); });
  });

  it('renders actions on the right side', () => {
    const { root, container } = render(
      <PageHeader title="Home" actions={<button type="button">Add</button>} />,
    );
    expect(container.querySelector('button')!.textContent).toBe('Add');
    act(() => { root.unmount(); });
  });
});
