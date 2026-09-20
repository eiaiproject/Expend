/// <reference types="vite/client" />
declare const __APP_VERSION__: string;
/** Worker + core Tesseract tersedia lokal (hasil scripts/vendor-tesseract.mjs). */
const __OCR_CORE_LOCAL__: boolean;
/** Model bahasa ind/eng tersedia lokal; kalau tidak, langPath tetap ke CDN. */
const __OCR_LANG_LOCAL__: boolean;
