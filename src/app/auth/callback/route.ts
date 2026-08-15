import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing. Supabase sends the owner here with a one-time credential
 * which we swap for a session cookie, then drop them at the dashboard — which
 * forwards to /onboarding if they haven't created their shop yet.
 *
 * Two shapes arrive here:
 *   ?code=...                  PKCE, used by signInWithOtp from the browser
 *   ?token_hash=...&type=...   the link shape Supabase's own email templates
 *                              and admin-generated links use
 *
 * Supporting both means a link still works if it was generated server-side
 * or if an email client rewrote it, instead of dead-ending at the login page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  let failed = true;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    failed = Boolean(error);
  } else {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  if (failed) {
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  // Only ever redirect within this app.
  const target = next.startsWith("/") ? next : "/dashboard";
  return NextResponse.redirect(`${origin}${target}`);
}
