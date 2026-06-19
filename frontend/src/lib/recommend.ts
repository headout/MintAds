import type { RecommendationGroup } from './types';

export interface Partitioned<T> {
  recommended: T[];
  works: T[];
  rest: T[];
}

/**
 * Split a list into Recommended / Works / Rest buckets for a dependent dropdown.
 * Recommended + Works follow the group's own ordering (best first); anything in
 * neither bucket falls to `rest` in the original source order.
 */
export function partitionByRecommendation<T extends { id: string }>(
  items: T[],
  group: RecommendationGroup | undefined,
): Partitioned<T> {
  if (!group) {
    return { recommended: [], works: [], rest: [...items] };
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  const pick = (ids: string[]): T[] =>
    ids.map((id) => byId.get(id)).filter((item): item is T => item !== undefined);

  const recommended = pick(group.recommended);
  const works = pick(group.works);
  const claimed = new Set([...group.recommended, ...group.works]);
  const rest = items.filter((item) => !claimed.has(item.id));

  return { recommended, works, rest };
}
