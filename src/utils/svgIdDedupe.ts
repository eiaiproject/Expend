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

export function dedupeSvgClipIds(root: ParentNode = document): void {
  const seen = new Set<string>();

  for (const clip of root.querySelectorAll('clipPath[id]')) {
    const id = clip.id;
    if (!seen.has(id)) {
      seen.add(id);
      continue;
    }

    // Duplicate → give it a unique id and rewrite references inside its own <svg>.
    dedupeRenameCounter += 1;
    const newId = `${id}_dup${dedupeRenameCounter}`;
    clip.id = newId;
    seen.add(newId);

    const svg = clip.closest('svg');
    if (!svg) continue;

    for (const ref of svg.querySelectorAll<SVGElement>('[clip-path]')) {
      const attr = ref.getAttribute('clip-path');
      if (attr && attr.includes(`url(#${id})`)) {
        ref.setAttribute('clip-path', attr.replace(`url(#${id})`, `url(#${newId})`));
      }
    }
    for (const ref of svg.querySelectorAll<SVGElement>('[style*="clip-path"]')) {
      const style = ref.getAttribute('style');
      if (style && style.includes(`url(#${id})`)) {
        ref.setAttribute('style', style.replace(`url(#${id})`, `url(#${newId})`));
      }
    }
  }
}

let observer: MutationObserver | null = null;

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
    // Check added nodes RECURSIVELY: icons are usually nested inside the
    // added wrapper (e.g. a <li> row), not added as top-level <svg> nodes.
    const touchesSvg = records.some((r) => {
      if (r.target instanceof SVGElement) return true;
      for (const node of r.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node instanceof SVGElement) return true;
        if (node.querySelector('svg, clipPath, [clip-path]')) return true;
      }
      return false;
    });
    if (touchesSvg) dedupeSvgClipIds(root);
  });
  observer.observe(root, { childList: true, subtree: true });
}
