import type { VariantConfig, BoardSize, Position } from '../game/types';

function siegePositions(size: BoardSize): Position[][] {
  const margin = size <= 6 ? 0 : 1;
  const whitePositions: Position[] = [];
  const blackPositions: Position[] = [];

  // 白方沿上边排列
  for (let i = 0; i < 6; i++) {
    const col = margin + Math.floor(i * (size - 2 * margin) / 5);
    whitePositions.push({ row: margin, col });
  }

  // 黑方沿下边排列
  for (let i = 0; i < 6; i++) {
    const col = margin + Math.floor(i * (size - 2 * margin) / 5);
    blackPositions.push({ row: size - 1 - margin, col });
  }

  return [whitePositions, blackPositions];
}

export const siegeVariant: VariantConfig = {
  id: 'siege',
  name: '围城之战',
  description: '每方 6 个亚马逊，大规模史诗对决，场面宏大',
  recommendedSizes: [10, 14],
  amazonCount: 6,
  startingPositions: siegePositions,
};
