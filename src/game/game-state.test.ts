import { describe, expect, it } from 'vitest';
import {
  checkGameEnd,
  createInitialState,
  getLegalShots,
  hasAnyLegalMove,
  moveAmazon,
  selectAmazon,
  shootArrow,
} from './game-state';
import type { Position } from './types';

const starts: Position[][] = [
  [{ row: 0, col: 0 }],
  [{ row: 5, col: 5 }],
];

describe('game state transitions', () => {
  it('moves, shoots, records history, and changes player', () => {
    const initial = createInitialState(6, starts);
    const selected = selectAmazon(initial, { row: 0, col: 0 });
    expect(selected?.selectedAmazonId).toBe('white-0');

    const moved = moveAmazon(selected!, { row: 0, col: 3 });
    expect(moved?.step).toBe('shoot');

    const shots = getLegalShots(moved!);
    expect(shots.some(pos => pos.row === 3 && pos.col === 3)).toBe(true);

    const next = shootArrow(moved!, { row: 3, col: 3 });
    expect(next?.currentPlayer).toBe('black');
    expect(next?.step).toBe('move');
    expect(next?.moveHistory).toHaveLength(1);
    expect(next?.burnedCells).toEqual([{ row: 3, col: 3 }]);
  });

  it('detects players with no legal move', () => {
    const state = createInitialState(6, starts);
    const trapped = {
      ...state,
      amazons: [
        { id: 'white-0', player: 'white' as const, position: { row: 0, col: 0 } },
        { id: 'black-0', player: 'black' as const, position: { row: 5, col: 5 } },
      ],
      burnedCells: [
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
      ],
    };

    expect(hasAnyLegalMove(trapped, 'white')).toBe(false);
    expect(checkGameEnd(trapped)).toBe('black');
  });
});
