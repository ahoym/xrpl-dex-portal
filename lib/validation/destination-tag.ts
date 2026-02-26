/**
 * Parse an optional destination tag string into a validated number.
 *
 * Returns `{ tag: undefined }` for empty/blank input,
 * `{ tag: number }` for a valid non-negative integer,
 * or `{ error: string }` for invalid input.
 */
export function parseDestinationTag(
  value: string,
):
  | { tag: number; error?: undefined }
  | { tag: undefined; error?: undefined }
  | { tag?: undefined; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { tag: undefined };
  const parsed = parseInt(trimmed, 10);
  if (isNaN(parsed) || parsed < 0) {
    return { error: "Destination tag must be a non-negative integer" };
  }
  return { tag: parsed };
}
