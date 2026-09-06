/**
 * Shared fractional-index ordering maths.
 *
 * Tasks (inside a column) and columns (inside a board) are ordered the same
 * way, so the arithmetic lives here once and both move services call it.
 *
 * `position` is a float. Dropping an item between two neighbours only needs
 * the average of their positions, so a move writes one row instead of
 * renumbering the whole list.
 */

/** Spacing used when a list is renumbered, and for the first item in one. */
export const POSITION_SPACING = 1024;

/**
 * Smallest gap we will split before renumbering the list instead.
 *
 * Fractional indexing halves the gap on every drop into the same slot, so
 * `position` shrinks geometrically: dropping repeatedly at the top of a column
 * took it from 1024 to ~7e-18 in 120 moves. Left alone it reaches 0 after
 * roughly 1080 moves, and from then on `after / 2` is also 0 - items tie and
 * ordering silently stops working, with no error anywhere. Renumbering well
 * before that keeps the gaps healthy.
 */
export const MIN_GAP = 1e-4;

export interface PlacementResult {
  /** `index` clamped into the range the sibling list actually allows. */
  index: number;
  /** The position to write, when `needsRenumber` is false. */
  position: number;
  /** True when the gap has collapsed and the whole list must be rewritten. */
  needsRenumber: boolean;
}

/**
 * Works out where an item dropped at `rawIndex` should sit among `siblings`
 * (which must be sorted by position ascending and must NOT include the item
 * being moved).
 */
export function placeBetween(siblings: { position: number }[], rawIndex: number): PlacementResult {
  const index = Math.min(Math.max(rawIndex, 0), siblings.length);
  const before = index > 0 ? siblings[index - 1].position : null;
  const after = index < siblings.length ? siblings[index].position : null;

  let position: number;
  if (before === null && after === null) {
    position = POSITION_SPACING; // first item ever placed in this list
  } else if (before === null) {
    position = after! / 2; // becomes the new first item
  } else if (after === null) {
    position = before + 1; // becomes the new last item
  } else {
    position = (before + after) / 2; // slots in between two existing items
  }

  // The gap we just split (or the headroom below the first item) has become
  // too small to keep halving. The caller renumbers the whole list instead -
  // same visible order, healthy gaps again.
  const gap = before !== null && after !== null ? after - before : (after ?? Infinity);
  const needsRenumber = gap < MIN_GAP || !Number.isFinite(position) || position <= 0;

  return { index, position, needsRenumber };
}

/**
 * The ids of `siblings` with `movingId` spliced in at `index` - the order a
 * renumber should write out.
 */
export function orderWithMovingItem(siblings: { id: string }[], movingId: string, index: number) {
  const ordered = siblings.map((s) => s.id);
  ordered.splice(index, 0, movingId);
  return ordered;
}

/** The position the item at `i` gets when a list is renumbered. */
export function renumberedPosition(i: number) {
  return (i + 1) * POSITION_SPACING;
}
