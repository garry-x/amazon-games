import { describe, expect, it } from 'vitest';
import { buildBlockedSet, getQueenMoves } from './rules';
import type { Position } from './types';

function hasPos(positions: Position[], row: number, col: number): boolean {
  return positions.some(pos => pos.row === row && pos.col === col);
}

describe('getQueenMoves', () => {
  it('walks in all eight directions until the board edge', () => {
    const moves = getQueenMoves({ row: 2, col: 2 }, 6, new Set());

    expect(moves).toHaveLength(19);
    expect(hasPos(moves, 0, 0)).toBe(true);
    expect(hasPos(moves, 5, 5)).toBe(true);
    expect(hasPos(moves, 2, 5)).toBe(true);
    expect(hasPos(moves, 5, 2)).toBe(true);
  });

  it('stops before blocked cells', () => {
    const blocked = buildBlockedSet(
      [{ position: { row: 2, col: 4 } }],
      [{ row: 4, col: 2 }],
    );
    const moves = getQueenMoves({ row: 2, col: 2 }, 6, blocked);

    expect(hasPos(moves, 2, 3)).toBe(true);
    expect(hasPos(moves, 2, 4)).toBe(false);
    expect(hasPos(moves, 2, 5)).toBe(false);
    expect(hasPos(moves, 3, 2)).toBe(true);
    expect(hasPos(moves, 4, 2)).toBe(false);
  });
});
