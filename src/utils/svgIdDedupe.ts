/**
 * Rename duplicated SVG `clipPath` ids so the document never contains two
 * elements with the same id (design audit).
 *
 * Background: reicon-react icons embed a static `clip0_<hash>` clipPath id.
 * Rendering the same icon twice (e.g. the same icon in two nav entries)
 * produces two identical `clipPath` elements with the same id — invalid
 * HTML, and screen readers / validators flag it. The definitions are
 * identical, so keeping the first occurrence and renaming the rest is safe:
 * any reference to the original id still resolves to an identical path.
 */
// Module-level counter so renamed ids stay unique ACROSS batches (a local
// counter would collide when the same icon mounts again in a later mutation).
let dedupeRenameCounter = 0;

/**
 * Rewrite `url(#oldId)` → `url(#newId)` inside `ref`'s clip-path attribute or
 * inline style. Returns true if anything was rewritten.
 */
function rewriteClipAttr(ref: SVGElement, oldId: string, newId: string): boolean {
  const attr = ref.getAttribute('clip-path');
  if (attr?.includes(`url(#${oldId})`)) {
    ref.setAttribute('clip-path', attr.replace(`url(#${oldId})`, `url(#${newId})`));
    return true;
  }
  const style = ref.getAttribute('style');
  if (style?.includes(`url(#${oldId})`)) {
    ref.setAttribute('style', style.replace(`url(#${oldId})`, `url(#${newId})`));
    return true;
  }
  return false;
}

/**
 * Rename `clip`'s id to a unique suffix and rewrite every reference inside
 * its parent <svg>. Returns the new id, or null if `clip` has no <svg>
 * ancestor (nothing to rewrite).
 */
function renameDuplicateClip(clip: Element, originalId: string): string | null {
  dedupeRenameCounter += 1;
  const newId = `${originalId}_dup${dedupeRenameCounter}`;
  clip.id = newId;
  const svg = clip.closest('svg');
  if (!svg) return null;
  for (const ref of svg.querySelectorAll<SVGElement>('[clip-path], [style*="clip-path"]')) {
    rewriteClipAttr(ref, originalId, newId);
  }
  return newId;
}

export function dedupeSvgClipIds(root: ParentNode = document): void {
  const seen = new Set<string>();

  for (const clip of root.querySelectorAll('clipPath[id]')) {
    const id = clip.id;
    if (!seen.has(id)) {
      seen.add(id);
      continue;
    }
    const newId = renameDuplicateClip(clip, id);
    if (newId) seen.add(newId);
  }
}

let observer: MutationObserver | null = null;

/**
 * True if `record`'s added nodes (recursively) include any <svg>, <clipPath>,
 * or element that already has a clip-path attribute — i.e. could introduce a
 * new clipPath id we'd need to dedupe.
 */
function recordTouchesSvg(record: MutationRecord): boolean {
  if (record.target instanceof SVGElement) return true;
  for (const node of record.addedNodes) {
    if (!(node instanceof Element)) continue;
    if (node instanceof SVGElement) return true;
    if (node.querySelector('svg, clipPath, [clip-path]')) return true;
  }
  return false;
}

/**
 * Keep the document free of duplicate SVG clipPath ids for the app's whole
 * lifetime. Lazy-loaded routes and async Dexie live queries render icons
 * *after* mount, so a one-shot dedupe pass is not enough — watch the DOM and
 * re-run the rename whenever new nodes (and their embedded clipPaths) appear.
 */
export function initSvgClipDedupe(root: ParentNode = document): void {
  dedupeSvgClipIds(root);
  if (observer) return;

  observer = new MutationObserver((records) => {
    // Skip mutations that cannot introduce new clipPaths (e.g. typing in a
    // form field) so the dedupe scan adds no meaningful overhead at runtime.
    if (records.some(recordTouchesSvg)) dedupeSvgClipIds(root);
  });
  observer.observe(root, { childList: true, subtree: true });
}