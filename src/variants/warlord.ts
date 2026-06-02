import type { VariantConfig, BoardSize, Position } from '../game/types';

function warlordPositions(size: BoardSize): Position[][] {
  return [
    // 白方：放在棋盘上方两侧
    [
      { row: 0, col: 0 },
      { row: 0, col: size - 1 },
    ],
    // 黑方：放在棋盘下方中间
    [
      { row: size - 1, col: Math.floor(size / 3) },
      { row: size - 1, col: Math.floor(2 * size / 3) },
    ],
  ];
}

export const warlordVariant: VariantConfig = {
  id: 'warlord',
  name: '军阀对决',
  description: '每方仅 2 个亚马逊，更快节奏的快速对决',
  recommendedSizes: [6, 10],
  amazonCount: 2,
  startingPositions: warlordPositions,
};
