/**
 * Deduplicate an array of items by a string key, preserving order.
 * The first occurrence of each key is kept.
 */
export function deduplicateByHash<T extends { hash: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.hash)) continue;
    seen.add(item.hash);
    result.push(item);
  }
  return result;
}
