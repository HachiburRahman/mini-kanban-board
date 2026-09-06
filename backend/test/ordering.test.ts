import { describe, it, expect } from 'vitest';
import {
  MIN_GAP,
  POSITION_SPACING,
  orderWithMovingItem,
  placeBetween,
  renumberedPosition,
} from '../src/common/ordering.js';

const at = (...positions: number[]) => positions.map((position, i) => ({ id: `s${i}`, position }));

describe('placeBetween - fractional index maths', () => {
  it('seeds POSITION_SPACING for the first item in an empty list', () => {
    expect(placeBetween([], 0)).toMatchObject({ position: POSITION_SPACING, needsRenumber: false });
  });

  it('halves the first position when inserting at the top', () => {
    expect(placeBetween(at(100, 200), 0).position).toBe(50);
  });

  it('averages the two neighbours when inserting in the middle', () => {
    expect(placeBetween(at(100, 200), 1).position).toBe(150);
  });

  it('adds 1 past the last position when inserting at the bottom', () => {
    expect(placeBetween(at(100, 200), 2).position).toBe(201);
  });

  it('clamps an index past the end', () => {
    expect(placeBetween(at(100, 200), 99)).toMatchObject({ index: 2, position: 201 });
  });

  it('clamps a negative index to the top', () => {
    expect(placeBetween(at(100, 200), -5)).toMatchObject({ index: 0, position: 50 });
  });
});

describe('placeBetween - renumber guard', () => {
  it('does not renumber while there is room between neighbours', () => {
    expect(placeBetween(at(100, 200), 1).needsRenumber).toBe(false);
  });

  it('renumbers once the gap between neighbours is exhausted', () => {
    const tight = MIN_GAP / 10;
    expect(placeBetween(at(100, 100 + tight), 1).needsRenumber).toBe(true);
  });

  it('renumbers once the headroom below the first item is exhausted', () => {
    expect(placeBetween(at(MIN_GAP / 10, 500), 0).needsRenumber).toBe(true);
  });

  it('renumbers rather than writing a zero position', () => {
    expect(placeBetween(at(Number.MIN_VALUE, 500), 0).needsRenumber).toBe(true);
  });

  it('never proposes a non-positive position without asking for a renumber', () => {
    // 2000 halvings at the top is far past the point floats give up.
    let siblings = at(POSITION_SPACING);
    let renumbers = 0;
    for (let i = 0; i < 2000; i++) {
      const { position, needsRenumber } = placeBetween(siblings, 0);
      if (needsRenumber) {
        renumbers++;
        siblings = at(renumberedPosition(0), renumberedPosition(1));
        continue;
      }
      expect(position).toBeGreaterThan(0);
      expect(Number.isFinite(position)).toBe(true);
      siblings = at(position);
    }
    expect(renumbers).toBeGreaterThan(0);
  });
});

describe('orderWithMovingItem', () => {
  it('splices the moving id in at the requested index', () => {
    expect(orderWithMovingItem(at(1, 2, 3), 'moving', 1)).toEqual(['s0', 'moving', 's1', 's2']);
  });

  it('appends when the index is the list length', () => {
    expect(orderWithMovingItem(at(1, 2), 'moving', 2)).toEqual(['s0', 's1', 'moving']);
  });

  it('does not mutate the sibling list it was given', () => {
    const siblings = at(1, 2);
    orderWithMovingItem(siblings, 'moving', 0);
    expect(siblings.map((s) => s.id)).toEqual(['s0', 's1']);
  });
});

describe('renumberedPosition', () => {
  it('spaces items on POSITION_SPACING multiples starting at 1x', () => {
    expect([0, 1, 2].map(renumberedPosition)).toEqual([1024, 2048, 3072]);
  });
});
