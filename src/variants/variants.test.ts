import { describe, expect, it } from 'vitest';
import { classicVariant } from './classic';
import { siegeVariant } from './siege';
import { warlordVariant } from './warlord';
import type { BoardSize, VariantConfig } from '../game/types';

function expectVariantPositions(variant: VariantConfig, size: BoardSize) {
  const [white, black] = variant.startingPositions(size);
  expect(white).toHaveLength(variant.amazonCount);
  expect(black).toHaveLength(variant.amazonCount);
  for (const pos of [...white, ...black]) {
    expect(pos.row).toBeGreaterThanOrEqual(0);
    expect(pos.row).toBeLessThan(size);
    expect(pos.col).toBeGreaterThanOrEqual(0);
    expect(pos.col).toBeLessThan(size);
  }
}

describe('variant starting positions', () => {
  it('keeps all classic positions inside supported boards', () => {
    for (const size of classicVariant.recommendedSizes) expectVariantPositions(classicVariant, size);
  });

  it('keeps all warlord positions inside supported boards', () => {
    for (const size of warlordVariant.recommendedSizes) expectVariantPositions(warlordVariant, size);
  });

  it('keeps all siege positions inside supported boards', () => {
    for (const size of siegeVariant.recommendedSizes) expectVariantPositions(siegeVariant, size);
  });
});
