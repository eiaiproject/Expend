/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.json' {
  const value: Record<string, unknown>;
  export default value;
}

declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;
declare const __GIT_HASH__: string;
