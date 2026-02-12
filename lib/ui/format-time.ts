/**
 * Format an ISO date string as a short time (HH:MM:SS).
 * Returns "—" for empty or invalid input.
 */
export function formatTime(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

/**
 * Format an ISO date string as a full locale date-time string.
 * Returns "" for empty or invalid input.
 */
export function formatDateTime(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
}
