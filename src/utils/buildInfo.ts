/**
 * Identitas build per-commit: SemVer rilis + SHA commit + tanggal build.
 * Setiap commit menghasilkan build yang teridentifikasi unik tanpa
 * menaikkan versi rilis tiap commit. Fallback aman di luar vite build
 * (mis. unit test yang tidak mendefinisikan constant-nya).
 */
export interface BuildInfo {
  version: string;
  commit: string;
  date: string;
}

export function buildInfo(): BuildInfo {
  const version = typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ ? __APP_VERSION__ : '0.0.0';
  const commit = typeof __APP_COMMIT__ !== 'undefined' && __APP_COMMIT__ ? __APP_COMMIT__ : 'dev';
  const date = typeof __APP_BUILD_DATE__ !== 'undefined' && __APP_BUILD_DATE__ ? __APP_BUILD_DATE__ : '';
  return { version, commit, date };
}
