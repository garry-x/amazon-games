import type {
  GameState, GamePhase, Player, Position,
  Move, Amazon, BoardSize, GameStats,
} from './types';
import { posEqual, posKey, buildBlockedSet, getQueenMoves, opponent, clonePos } from './rules';

/**
 * 创建一个新的游戏初始状态
 */
export function createInitialState(
  boardSize: BoardSize,
  startingPositions: Position[][],
): GameState {
  const [whitePositions, blackPositions] = startingPositions;
  const amazons: Amazon[] = [];

  whitePositions.forEach((pos, i) => {
    amazons.push({ id: `white-${i}`, player: 'white', position: clonePos(pos) });
  });
  blackPositions.forEach((pos, i) => {
    amazons.push({ id: `black-${i}`, player: 'black', position: clonePos(pos) });
  });

  return {
    phase: 'playing',
    boardSize,
    currentPlayer: 'white',
    amazons,
    burnedCells: [],
    moveHistory: [],
    winner: null,
    selectedAmazonId: null,
    step: 'move',
    pendingMoveTo: null,
  };
}

/**
 * 获取某个位置的亚马逊（如果有）
 */
export function getAmazonAt(state: GameState, pos: Position): Amazon | null {
  return state.amazons.find(a => posEqual(a.position, pos)) ?? null;
}

/**
 * 获取某个玩家的所有亚马逊
 */
export function getPlayerAmazons(state: GameState, player: Player): Amazon[] {
  return state.amazons.filter(a => a.player === player);
}

/**
 * 检查某个位置是否是障碍（亚马逊或燃烧格）
 */
export function isBlocked(state: GameState, pos: Position, excludeAmazonId?: string): boolean {
  if (state.burnedCells.some(b => posEqual(b, pos))) return true;
  const amazon = state.amazons.find(a => posEqual(a.position, pos));
  if (amazon && amazon.id !== excludeAmazonId) return true;
  return false;
}

/**
 * 选择一个亚马逊（仅在移动阶段有效）
 */
export function selectAmazon(state: GameState, pos: Position): GameState | null {
  if (state.step !== 'move') return null;

  const amazon = state.amazons.find(
    a => posEqual(a.position, pos) && a.player === state.currentPlayer,
  );
  if (!amazon) return null;

  return {
    ...state,
    selectedAmazonId: amazon.id,
  };
}

/**
 * 获取当前选中亚马逊的合法移动目标
 */
export function getLegalMoves(state: GameState): Position[] {
  if (!state.selectedAmazonId || state.step !== 'move') return [];

  const amazon = state.amazons.find(a => a.id === state.selectedAmazonId);
  if (!amazon) return [];

  const blocked = buildBlockedSet(state.amazons, state.burnedCells);
  return getQueenMoves(amazon.position, state.boardSize, blocked);
}

/**
 * 移动选中的亚马逊到目标位置
 * 返回新状态（进入射箭阶段）
 */
export function moveAmazon(state: GameState, to: Position): GameState | null {
  if (state.step !== 'move' || !state.selectedAmazonId) return null;

  const legal = getLegalMoves(state);
  if (!legal.some(p => posEqual(p, to))) return null;

  return {
    ...state,
    step: 'shoot',
    pendingMoveTo: clonePos(to),
  };
}

/**
 * 获取当前射箭阶段的合法目标
 */
export function getLegalShots(state: GameState): Position[] {
  if (state.step !== 'shoot' || !state.pendingMoveTo) return [];

  // 创建包含新位置的临时亚马逊列表
  const tempAmazons = state.amazons.map(a =>
    a.id === state.selectedAmazonId
      ? { ...a, position: clonePos(state.pendingMoveTo!) }
      : a,
  );

  const blocked = buildBlockedSet(tempAmazons, state.burnedCells);
  return getQueenMoves(state.pendingMoveTo, state.boardSize, blocked);
}

/**
 * 射箭并完成回合
 * 返回新状态（切换到对手，进入移动阶段）
 */
export function shootArrow(state: GameState, arrowTarget: Position): GameState | null {
  if (state.step !== 'shoot' || !state.selectedAmazonId || !state.pendingMoveTo) return null;

  const legal = getLegalShots(state);
  if (!legal.some(p => posEqual(p, arrowTarget))) return null;

  const fromPos = state.amazons.find(a => a.id === state.selectedAmazonId)!.position;

  const move: Move = {
    amazonId: state.selectedAmazonId,
    from: clonePos(fromPos),
    to: clonePos(state.pendingMoveTo),
    arrow: clonePos(arrowTarget),
  };

  // 更新亚马逊位置
  const newAmazons = state.amazons.map(a =>
    a.id === state.selectedAmazonId
      ? { ...a, position: clonePos(state.pendingMoveTo) }
      : a,
  );

  const newState: GameState = {
    ...state,
    amazons: newAmazons,
    burnedCells: [...state.burnedCells, clonePos(arrowTarget)],
    moveHistory: [...state.moveHistory, move],
    selectedAmazonId: null,
    step: 'move',
    pendingMoveTo: null,
    currentPlayer: opponent(state.currentPlayer),
  };

  // 检查对手是否还有合法移动
  const opponentPlayer = opponent(state.currentPlayer);
  if (!hasAnyLegalMove(newState, opponentPlayer)) {
    newState.phase = 'finished';
    newState.winner = state.currentPlayer; // 当前玩家获胜
  }

  return newState;
}

/**
 * 检查某个玩家是否有任何合法移动
 */
export function hasAnyLegalMove(state: GameState, player: Player): boolean {
  const playerAmazons = state.amazons.filter(a => a.player === player);
  const blocked = buildBlockedSet(state.amazons, state.burnedCells);

  for (const amazon of playerAmazons) {
    const moves = getQueenMoves(amazon.position, state.boardSize, blocked);
    if (moves.length > 0) {
      // 还需要确认移动后还能射箭
      for (const moveTo of moves) {
        const tempAmazons = state.amazons.map(a =>
          a.id === amazon.id ? { ...a, position: clonePos(moveTo) } : a,
        );
        const newBlocked = buildBlockedSet(tempAmazons, state.burnedCells);
        const shots = getQueenMoves(moveTo, state.boardSize, newBlocked);
        if (shots.length > 0) return true;
      }
    }
  }

  return false;
}

/**
 * 计算游戏统计数据
 */
export function computeStats(state: GameState): GameStats {
  let whiteMoves = 0;
  let blackMoves = 0;
  for (const move of state.moveHistory) {
    const amazon = state.amazons.find(a => a.id === move.amazonId);
    if (amazon) {
      if (amazon.player === 'white') whiteMoves++;
      else blackMoves++;
    }
  }
  return {
    totalMoves: state.moveHistory.length,
    whiteMoves,
    blackMoves,
    burnedCells: state.burnedCells.length,
    startTime: 0,
    endTime: null,
  };
}
