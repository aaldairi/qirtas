import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const VISITOR_COOKIE = "qirtas_v";

/**
 * Two jobs per request:
 *  1. Refresh the Supabase auth cookie so a signed-in owner never gets
 *     bounced to /login mid-session (Server Components can't write cookies,
 *     so this is the only place the refreshed token can be persisted).
 *  2. Hand every visitor an anonymous id, used purely to count one QR scan
 *     per person per product per day.
 */
export async function proxy(request: NextRequest) {
  // Set on the request *before* building the response: NextResponse.next()
  // snapshots the request headers, so a cookie added afterwards would not
  // reach this render — only the next one.
  let visitor = request.cookies.get(VISITOR_COOKIE)?.value ?? null;
  const isNewVisitor = !visitor;
  if (!visitor) {
    visitor = crypto.randomUUID();
    request.cookies.set(VISITOR_COOKIE, visitor);
  }

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // Supabase rebuilds the response here, so anything set on the old
          // one is gone — the visitor cookie is re-applied below.
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    await supabase.auth.getUser();
  }

  if (isNewVisitor && visitor) {
    response.cookies.set(VISITOR_COOKIE, visitor, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
