import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing. Supabase sends the owner here with a one-time code;
 * we swap it for a session cookie and drop them at the dashboard, which
 * forwards to /onboarding if they haven't created their shop yet.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  // Only ever redirect within this app.
  const target = next.startsWith("/") ? next : "/dashboard";
  return NextResponse.redirect(`${origin}${target}`);
}
