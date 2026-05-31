import { create } from 'zustand';
import type { GameState, BoardSize, Position } from '../game/types';
import type { VariantConfig } from '../game/types';
import {
  createInitialState, selectAmazon, moveAmazon, shootArrow,
  checkCurrentPlayerStuck, hasAnyLegalMove,
} from '../game/game-state';
import { opponent } from '../game/rules';
import { classicVariant } from '../variants/classic';
import { warlordVariant } from '../variants/warlord';
import { siegeVariant } from '../variants/siege';

export const ALL_VARIANTS: VariantConfig[] = [
  classicVariant,
  warlordVariant,
  siegeVariant,
];

interface GameStore {
  gameState: GameState | null;
  variant: VariantConfig | null;

  startGame: (variant: VariantConfig, boardSize: BoardSize) => void;
  resetGame: () => void;
  handleCellClick: (pos: Position) => void;
  forfeit: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  variant: null,

  startGame: (variant, boardSize) => {
    const positions = variant.startingPositions(boardSize);
    const state = createInitialState(boardSize, positions);

    // 开局检查：白方是否有合法走法
    if (!hasAnyLegalMove(state, 'white')) {
      const blackCanMove = hasAnyLegalMove(state, 'black');
      set({
        gameState: {
          ...state,
          phase: 'finished',
          winner: blackCanMove ? 'black' : null,
        },
        variant,
      });
      return;
    }

    set({ gameState: state, variant });
  },

  resetGame: () => {
    const { variant, gameState } = get();
    if (variant && gameState) {
      const positions = variant.startingPositions(gameState.boardSize);
      const state = createInitialState(gameState.boardSize, positions);
      set({ gameState: state });
    }
  },

  handleCellClick: (pos) => {
    const { gameState } = get();
    if (!gameState || gameState.phase !== 'playing') return;

    if (gameState.step === 'move') {
      // 回合开始检查：当前玩家能否行动
      const stuckCheck = checkCurrentPlayerStuck(gameState);
      if (stuckCheck !== undefined) {
        set({
          gameState: {
            ...gameState,
            phase: 'finished',
            winner: stuckCheck, // null = draw, Player = opponent wins
          },
        });
        return;
      }

      const clickedAmazon = gameState.amazons.find(
        a => a.position.row === pos.row && a.position.col === pos.col && a.player === gameState.currentPlayer,
      );

      if (clickedAmazon) {
        const newState = selectAmazon(gameState, pos);
        if (newState) set({ gameState: newState });
        return;
      }

      if (gameState.selectedAmazonId) {
        const newState = moveAmazon(gameState, pos);
        if (newState) {
          set({ gameState: newState });
          return;
        }
        set({ gameState: { ...gameState, selectedAmazonId: null } });
      }
    } else if (gameState.step === 'shoot') {
      const newState = shootArrow(gameState, pos);
      if (newState) set({ gameState: newState });
    }
  },

  forfeit: () => {
    const { gameState } = get();
    if (!gameState || gameState.phase !== 'playing') return;
    set({
      gameState: {
        ...gameState,
        phase: 'finished',
        winner: opponent(gameState.currentPlayer),
      },
    });
  },
}));
