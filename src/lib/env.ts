function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in — see README.md.`,
    );
  }
  return value;
}

/**
 * Which required variables are absent. Lets the app render a clear setup
 * screen on a fresh deployment instead of throwing a raw 500 at whoever
 * opens the URL first.
 */
export function missingEnv(): string[] {
  return (
    [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ] as const
  ).filter((name) => !process.env[name]);
}

export function isConfigured(): boolean {
  return missingEnv().length === 0;
}

export const env = {
  get supabaseUrl() {
    return required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    );
  },
  get supabaseAnonKey() {
    return required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  },
  get supabaseServiceKey() {
    return required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  },
};

/**
 * Absolute origin of this deployment. Every printed QR code is built from
 * this, so getting it wrong turns a sheet of shelf labels into landfill.
 *
 * Resolution order:
 *  1. NEXT_PUBLIC_SITE_URL — set this once a custom domain is attached.
 *  2. VERCEL_PROJECT_PRODUCTION_URL — the project's *stable* production
 *     domain, not the per-deployment preview host, so codes keep resolving
 *     across redeploys. Leaving NEXT_PUBLIC_SITE_URL unset on Vercel is the
 *     correct setup until a custom domain exists.
 *  3. localhost, for development.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null;

  // A localhost value copied out of .env.example must never win on a real
  // deployment — that would silently print unscannable labels.
  const explicitIsLocal =
    !!explicit && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(explicit);

  if (explicit && !(explicitIsLocal && vercel)) return explicit;
  if (vercel) return vercel;

  return "http://localhost:3000";
}
