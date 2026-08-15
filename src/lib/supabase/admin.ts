import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS, so every call site must have already
 * established that the caller owns the shop (see requireShop) or that the
 * request carries a valid unguessable order token.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
