/** 棋子颜色 / 玩家 */
export type Player = 'white' | 'black';

/** 棋盘格子状态 */
export type CellState = 'empty' | 'burned';

/** 棋盘坐标 */
export interface Position {
  row: number;
  col: number;
}

/** 一个亚马逊棋子 */
export interface Amazon {
  id: string;
  player: Player;
  position: Position;
}

/** 一步走棋：先移动亚马逊，再从新位置射箭 */
export interface Move {
  amazonId: string;
  from: Position;
  to: Position;
  arrow: Position;
}

/** 棋盘大小选项 */
export type BoardSize = 6 | 10 | 14;

/** 变体配置 */
export interface VariantConfig {
  id: string;
  name: string;
  description: string;
  /** 推荐棋盘大小 */
  recommendedSizes: BoardSize[];
  /** 每方亚马逊数量 */
  amazonCount: number;
  /** 初始摆放方式 */
  startingPositions: (size: BoardSize) => Position[][]; // [whitePositions, blackPositions]
}

/** 游戏阶段 */
export type GamePhase = 'setup' | 'playing' | 'finished';

/** 完整游戏状态 */
export interface GameState {
  phase: GamePhase;
  boardSize: BoardSize;
  currentPlayer: Player;
  amazons: Amazon[];
  burnedCells: Position[];
  moveHistory: Move[];
  winner: Player | null;
  /** 当前玩家的选中亚马逊 */
  selectedAmazonId: string | null;
  /** 当前步骤：'move' = 等待移动亚马逊, 'shoot' = 等待射箭 */
  step: 'move' | 'shoot';
  /** 移动后的暂存位置（用于射箭前临时显示） */
  pendingMoveTo: Position | null;
}

/** 游戏统计 */
export interface GameStats {
  totalMoves: number;
  whiteMoves: number;
  blackMoves: number;
  burnedCells: number;
  startTime: number;
  endTime: number | null;
}
