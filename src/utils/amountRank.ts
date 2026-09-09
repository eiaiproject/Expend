/**
 * Shared amount ranking for chat + receipt parsers.
 *
 * Both parsers solve the same problem ("which number in this text is the
 * money?") with the same heuristic. Scoring is **tier-based, not linear**:
 * context signals (suffix `rb`/`jt`, `Rp` prefix, total-like keywords) place a
 * candidate in a higher tier than its raw magnitude, so a bare reference/ID
 * number can no longer outrank a clearly-signaled amount just because it is
 * numerically larger. Within the same tier, larger values win.
 *
 * Tiers (higher = more likely the actual amount):
 *   3 - explicit money notation: Rp/IDR or suffix (rb/ribu/k/jt/juta)
 *   2 - total-like keyword nearby (total/jumlah/nominal/transfer/bayar)
 *   1 - bare plausible amount (100 .. 999.999.999)
 *   0 - bare tiny (<100: quantities/floors) or huge (>999M: IDs/refs)
 *
 * ponytail: single weight set for both callers. If chat vs receipt ever need
 * different weights, add an optional `weights` param here instead of forking
 * this module back into two scorers.
 */

export interface AmountSignals {
  /** Explicit suffix: jt/juta/rb/ribu/k - always monetary. */
  hasSuffix: boolean;
  /** `Rp`/`IDR` marker near the number - strong monetary signal. */
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

/**
 * Tier unit must dominate any possible `value` difference so a higher tier
 * always wins regardless of magnitude. Parsers bound candidate values to
 * ≤ 1e12, so 1e15 gives a safe margin while staying below Number.MAX_SAFE_INTEGER.
 */
const TIER_UNIT = 1e15;

export function amountTier(value: number, s: AmountSignals): number {
  if (s.hasSuffix || s.hasRp) return 3;
  if (s.hasKeyword) return 2;
  if (value >= 100 && value <= 999_999_999) return 1;
  return 0;
}

export function scoreAmount(value: number, s: AmountSignals): number {
  return amountTier(value, s) * TIER_UNIT + value;
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
