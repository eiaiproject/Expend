import wordSvg from '../assets/Expend-word.svg?raw';

// Aset wordmark diisi satu warna (#ddcbb7, untuk background gelap).
// Ganti ke currentColor agar hijau mengikuti token tema via text-*.
const WORD_SVG = wordSvg.replaceAll('#ddcbb7', 'currentColor');

/**
 * Wordmark Expend sebagai SVG inline (bukan <img>/<span role="img">):
 * warna dikendalikan class text-*, nama aksesibel disediakan pemanggil
 * (h1 sr-only di header Summary).
 */
export function Wordmark({ className }: { readonly className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block text-[var(--accent)] ${className ?? ''}`}
      style={{ aspectRatio: '615 / 119' }}
      dangerouslySetInnerHTML={{ __html: WORD_SVG }}
    />
  );
}
