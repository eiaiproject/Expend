/**
 * Metrik keyboard dari visualViewport.
 * Inset hanya dipercaya saat elemen editable sedang fokus; saat tidak ada
 * yang fokus, keyboard pasti sudah turun sehingga inset dipaksa 0.
 * Ini mencegah composer "nyangkut" di tengah layar bila event resize
 * dari visualViewport tidak sampai (ditemukan di sebagian Chrome Android).
 */
export function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return type !== 'file' && type !== 'checkbox' && type !== 'radio' && type !== 'submit';
  }
  return false;
}

export function keyboardInsetPx(innerHeight: number, vvHeight: number, offsetTop: number, editing: boolean): number {
  if (!editing) return 0;
  return Math.max(0, innerHeight - vvHeight - offsetTop);
}
