import { create } from 'zustand';
import type { GameState, BoardSize, Position, Player } from '../game/types';
import type { VariantConfig } from '../game/types';
import {
  createInitialState, selectAmazon, moveAmazon, shootArrow,
  checkCurrentPlayerStuck, hasAnyLegalMove,
} from '../game/game-state';
import { opponent } from '../game/rules';
import { classicVariant } from '../variants/classic';
import { warlordVariant } from '../variants/warlord';
import { siegeVariant } from '../variants/siege';
import { getAIMove, type AIDifficulty } from '../ai/engine';

export const ALL_VARIANTS: VariantConfig[] = [
  classicVariant,
  warlordVariant,
  siegeVariant,
];

export interface AIConfig {
  enabled: boolean;
  aiPlayer: Player;          // which side the AI plays
  difficulty: AIDifficulty;
}

const AI_CONFIG_KEY = 'math-games.ai-config';
const DEFAULT_AI_CONFIG: AIConfig = { enabled: false, aiPlayer: 'black', difficulty: 'medium' };
let aiAbortController: AbortController | null = null;
let aiRunId = 0;

function loadAIConfig(): AIConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_AI_CONFIG;
  try {
    const parsed = JSON.parse(localStorage.getItem(AI_CONFIG_KEY) ?? 'null') as Partial<AIConfig> | null;
    if (!parsed) return DEFAULT_AI_CONFIG;
    return { ...DEFAULT_AI_CONFIG, ...parsed };
  } catch {
    return DEFAULT_AI_CONFIG;
  }
}

function saveAIConfig(config: AIConfig): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
}

function cancelAIMove(): void {
  aiRunId += 1;
  aiAbortController?.abort();
  aiAbortController = null;
}

interface GameStore {
  gameState: GameState | null;
  variant: VariantConfig | null;
  aiConfig: AIConfig;
  aiThinking: boolean;
  gameStartTime: number;

  setAIConfig: (config: Partial<AIConfig>) => void;
  startGame: (variant: VariantConfig, boardSize: BoardSize) => void;
  resetGame: () => void;
  handleCellClick: (pos: Position) => void;
  forfeit: () => void;
  triggerAIMove: () => Promise<void>;
  cancelAIMove: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  variant: null,
  aiConfig: loadAIConfig(),
  aiThinking: false,
  gameStartTime: 0,

  setAIConfig: (config) => set(s => {
    const aiConfig = { ...s.aiConfig, ...config };
    saveAIConfig(aiConfig);
    return { aiConfig };
  }),

  startGame: (variant, boardSize) => {
    cancelAIMove();
    const positions = variant.startingPositions(boardSize);
    const state = createInitialState(boardSize, positions);

    if (!hasAnyLegalMove(state, 'white')) {
      const blackCanMove = hasAnyLegalMove(state, 'black');
      set({ gameState: { ...state, phase: 'finished', winner: blackCanMove ? 'black' : null }, variant });
      return;
    }

    set({ gameState: state, variant, gameStartTime: Date.now() });

    // If AI is white, trigger first move
    if (get().aiConfig.enabled && get().aiConfig.aiPlayer === 'white') {
      setTimeout(() => get().triggerAIMove(), 600);
    }
  },

  resetGame: () => {
    cancelAIMove();
    const { variant, gameState } = get();
    if (variant && gameState) {
      const positions = variant.startingPositions(gameState.boardSize);
      const state = createInitialState(gameState.boardSize, positions);
      set({ gameState: state });
      const { aiConfig } = get();
      if (aiConfig.enabled && aiConfig.aiPlayer === 'white') {
        setTimeout(() => get().triggerAIMove(), 500);
      }
    }
  },

  handleCellClick: (pos) => {
    const { gameState, aiConfig, aiThinking } = get();
    if (!gameState || gameState.phase !== 'playing') return;
    // Block human input during AI turn
    if (aiConfig.enabled && aiConfig.aiPlayer === gameState.currentPlayer && !aiThinking) return;
    if (aiThinking) return;

    if (gameState.step === 'move') {
      const stuckCheck = checkCurrentPlayerStuck(gameState);
      if (stuckCheck !== undefined) {
        set({ gameState: { ...gameState, phase: 'finished', winner: stuckCheck } });
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
      if (newState) {
        set({ gameState: newState });
        // Check if next player is AI (use newState directly, not get())
        const cfg = get().aiConfig;
        if (newState.phase === 'playing' && cfg.enabled && cfg.aiPlayer === newState.currentPlayer) {
          setTimeout(() => get().triggerAIMove(), 400);
        }
      }
    }
  },

  forfeit: () => {
    cancelAIMove();
    const { gameState } = get();
    if (!gameState || gameState.phase !== 'playing') return;
    set({ gameState: { ...gameState, phase: 'finished', winner: opponent(gameState.currentPlayer) } });
  },

  triggerAIMove: async () => {
    const { gameState, aiConfig, aiThinking } = get();
    if (!gameState || gameState.phase !== 'playing') return;
    if (!aiConfig.enabled || gameState.currentPlayer !== aiConfig.aiPlayer) return;
    if (aiThinking) return; // prevent concurrent AI requests

    cancelAIMove();
    const runId = aiRunId;
    aiAbortController = new AbortController();
    set({ aiThinking: true });

    try {
      const move = await getAIMove(gameState, aiConfig.difficulty, 2, 25000, aiAbortController.signal);
      if (runId !== aiRunId) return;
      if (!move) {
        // AI has no moves — forfeit
        set({
          gameState: { ...gameState, phase: 'finished', winner: opponent(gameState.currentPlayer) },
          aiThinking: false,
        });
        return;
      }

      // Execute AI move: select → move → shoot
      const fromPos = { row: move.fromRow, col: move.fromCol };
      const toPos = { row: move.toRow, col: move.toCol };
      const arrowPos = { row: move.arrowRow, col: move.arrowCol };

      let state = get().gameState!;
      if (state.phase !== 'playing') { set({ aiThinking: false }); return; }

      // Select
      state = selectAmazon(state, fromPos) || state;
      set({ gameState: state });
      await sleep(300);

      // Move
      state = moveAmazon(state, toPos) || state;
      set({ gameState: state });
      await sleep(300);

      // Shoot
      state = shootArrow(state, arrowPos) || state;
      set({ gameState: state });

      // Check if next player is also AI (shouldn't happen, but handle it)
      const next = get().gameState;
      const cfg = get().aiConfig;
      if (next && next.phase === 'playing' && cfg.enabled && cfg.aiPlayer === next.currentPlayer) {
        setTimeout(() => get().triggerAIMove(), 500);
      }
    } finally {
      if (runId === aiRunId) {
        aiAbortController = null;
        set({ aiThinking: false });
      }
    }
  },

  cancelAIMove: () => {
    cancelAIMove();
    set({ aiThinking: false });
  },
}));

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
