// Supabase refuses a second magic link inside 60s, and the shared mail sender
// caps the hour on top of that. Matching the shorter limit locally means the
// owner is told to wait instead of spending an allowance they cannot see.
export const COOLDOWN_SECONDS = 60;

export type LastRequest = { at: number; email: string };

/**
 * Seconds still to wait before another sign-in link may be requested.
 *
 * Clamped to the window length so a clock that jumps — or a stored timestamp
 * from the future — locks the form for a minute at worst, never for hours.
 */
export function secondsLeft(
  entry: LastRequest | null,
  now: number = Date.now(),
): number {
  if (!entry || !Number.isFinite(entry.at)) return 0;

  const left = Math.ceil((entry.at + COOLDOWN_SECONDS * 1000 - now) / 1000);
  if (left <= 0) return 0;

  return Math.min(left, COOLDOWN_SECONDS);
}

/** Parses whatever is in storage, treating anything unexpected as "no wait". */
export function parseLastRequest(raw: string | null): LastRequest | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LastRequest>;
    if (typeof parsed?.at !== "number" || !Number.isFinite(parsed.at)) {
      return null;
    }
    return { at: parsed.at, email: String(parsed.email ?? "") };
  } catch {
    return null;
  }
}
