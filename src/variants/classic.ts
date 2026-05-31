import type { VariantConfig, BoardSize, Position } from '../game/types';

function classicPositions(size: BoardSize): Position[][] {
  const margin = size <= 6 ? 0 : size <= 10 ? 1 : 2;
  return [
    // 白方（上方）
    [
      { row: margin, col: margin },
      { row: margin, col: size - 1 - margin },
      { row: size - 1 - margin, col: margin },
      { row: size - 1 - margin, col: size - 1 - margin },
    ],
    // 黑方（下方 / 对侧）
    [
      { row: margin + 1, col: margin + 1 },
      { row: margin + 1, col: size - 2 - margin },
      { row: size - 2 - margin, col: margin + 1 },
      { row: size - 2 - margin, col: size - 2 - margin },
    ],
  ];
}

export const classicVariant: VariantConfig = {
  id: 'classic',
  name: '经典模式',
  description: '标准亚马逊棋规则：每方 4 个亚马逊，棋盘四角对称布局',
  recommendedSizes: [6, 10, 14],
  amazonCount: 4,
  startingPositions: classicPositions,
};
