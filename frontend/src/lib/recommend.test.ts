import { describe, it, expect } from 'vitest';
import { partitionByRecommendation } from './recommend';

const items = [{ id: 'A1' }, { id: 'A2' }, { id: 'A3' }, { id: 'A4' }];

describe('partitionByRecommendation', () => {
  it('orders recommended items by the map order, not the source order', () => {
    const r = partitionByRecommendation(items, { recommended: ['A3', 'A1'], works: ['A2'] });
    expect(r.recommended.map((i) => i.id)).toEqual(['A3', 'A1']);
    expect(r.works.map((i) => i.id)).toEqual(['A2']);
  });

  it('puts items in neither list into rest, preserving source order', () => {
    const r = partitionByRecommendation(items, { recommended: ['A3'], works: ['A2'] });
    expect(r.rest.map((i) => i.id)).toEqual(['A1', 'A4']);
  });

  it('returns everything as rest when no group is provided', () => {
    const r = partitionByRecommendation(items, undefined);
    expect(r.recommended).toEqual([]);
    expect(r.works).toEqual([]);
    expect(r.rest.map((i) => i.id)).toEqual(['A1', 'A2', 'A3', 'A4']);
  });

  it('ignores recommended ids that do not exist in items', () => {
    const r = partitionByRecommendation(items, { recommended: ['ZZ', 'A1'], works: [] });
    expect(r.recommended.map((i) => i.id)).toEqual(['A1']);
  });
});
