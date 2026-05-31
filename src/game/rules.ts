import type { Position, Player } from './types';

/**
 * 检查一个位置是否在棋盘范围内
 */
export function isInBounds(pos: Position, size: number): boolean {
  return pos.row >= 0 && pos.row < size && pos.col >= 0 && pos.col < size;
}

/**
 * 判断两个位置是否相同
 */
export function posEqual(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

/**
 * 生成位置唯一键
 */
export function posKey(pos: Position): string {
  return `${pos.row},${pos.col}`;
}

/**
 * 建立一个快速查找集合
 */
export function buildBlockedSet(
  amazons: { position: Position }[],
  burnedCells: Position[],
): Set<string> {
  const set = new Set<string>();
  for (const a of amazons) {
    set.add(posKey(a.position));
  }
  for (const b of burnedCells) {
    set.add(posKey(b));
  }
  return set;
}

/**
 * 获取皇后走法的所有合法目标格
 * 沿着 8 个方向直线移动，直到碰到障碍或边界
 */
export function getQueenMoves(
  from: Position,
  size: number,
  blocked: Set<string>,
): Position[] {
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  const moves: Position[] = [];

  for (const [dr, dc] of directions) {
    let r = from.row + dr;
    let c = from.col + dc;
    while (r >= 0 && r < size && c >= 0 && c < size) {
      const key = `${r},${c}`;
      if (blocked.has(key)) break;
      moves.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
  }

  return moves;
}

/**
 * 获取当前玩家的对手
 */
export function opponent(player: Player): Player {
  return player === 'white' ? 'black' : 'white';
}

/**
 * 创建初始亚马逊ID
 */
export function makeAmazonId(player: Player, index: number): string {
  return `${player}-${index}`;
}

/**
 * 深拷贝一个位置
 */
export function clonePos(pos: Position): Position {
  return { row: pos.row, col: pos.col };
}
