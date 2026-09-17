export const ONBOARDED_KEY = 'expend_onboarded';

export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return true;
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
