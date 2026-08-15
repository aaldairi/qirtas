/**
 * Store slugs live in printed QR URLs, so they must be ASCII, stable, and
 * typo-proof. Arabic shop names transliterate to nothing here by design —
 * the setup form asks the owner to choose the link themselves in that case.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/** Slugs that would collide with app routes or read as official. */
const RESERVED = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "dashboard",
  "login",
  "logout",
  "onboarding",
  "qirtas",
  "s",
  "settings",
  "static",
  "support",
  "www",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug);
}
