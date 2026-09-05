/**
 * Shared amount ranking for chat + receipt parsers.
 *
 * Both parsers solve the same problem ("which number in this text is the
 * money?") with the same heuristic: explicit monetary signals (suffix like
 * `rb`/`jt`, `Rp` prefix, total-like keywords) multiply the raw value, while
 * tiny bare numbers (quantities, floor numbers) and huge bare numbers
 * (ref/account IDs) are penalized. One formula, tested once, used twice.
 *
 * ponytail: single weight set for both callers. If chat vs receipt ever need
 * different weights, add an optional `weights` param here instead of forking
 * this module back into two scorers.
 */

export interface AmountSignals {
  /** Explicit suffix: jt/juta/rb/ribu/k — always monetary. */
  hasSuffix: boolean;
  /** `Rp`/`IDR` marker near the number — strong monetary signal. */
  hasRp: boolean;
  /** Total-like keyword nearby (total/jumlah/nominal/transfer/bayar). */
  hasKeyword: boolean;
}

export interface RankedAmount {
  value: number;
  /** Char offset in the source text (used for description slicing). */
  index: number;
  signals: AmountSignals;
}

export function scoreAmount(value: number, s: AmountSignals): number {
  let score = value;
  if (s.hasSuffix) score *= 3;
  if (s.hasRp) score *= 2.5;
  if (s.hasKeyword) score *= 2.2;
  // Bare tiny numbers are quantities/floors, not money.
  if (!s.hasSuffix && !s.hasRp && value < 100) score *= 0.01;
  // Bare huge numbers are IDs/refs, not money.
  if (!s.hasSuffix && !s.hasRp && value > 999_999_999) score *= 0.001;
  return score;
}

/** Return the highest-scoring candidate (ties → larger value, then first). */
export function pickBestAmount<T extends RankedAmount>(candidates: readonly T[]): T | null {
  if (candidates.length === 0) return null;
  let best = candidates[0]!;
  let bestScore = scoreAmount(best.value, best.signals);
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    const s = scoreAmount(c.value, c.signals);
    if (s > bestScore || (s === bestScore && c.value > best.value)) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}
