export const ONBOARDED_KEY = 'expend_onboarded';

export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    // Fail-open: storage tak terbaca (private mode) → tampilkan coach agar
    // first-run tetap dapat panduan, bukan dianggap sudah onboard.
    return false;
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {}
}

export function clearOnboarded(): void {
  try {
    localStorage.removeItem(ONBOARDED_KEY);
  } catch {}
}
