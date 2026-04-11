import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getClerkTokenForSupabase } from "@/lib/supabase/clerk-token";

/**
 * Server Supabase client authorized with a Clerk JWT already resolved for this request.
 * Use inside `unstable_cache` / `"use cache"` callbacks where `auth()` is not allowed.
 */
export function createClientWithToken(accessTokenValue: string | null): SupabaseClient {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: async () => accessTokenValue,
    },
  );
}

/**
 * Server Supabase client authorized with the Clerk session JWT.
 * Uses @supabase/supabase-js with `accessToken` only — not @supabase/ssr's
 * createServerClient, which registers `onAuthStateChange` and is incompatible
 * with the accessToken option.
 *
 * The token resolver runs on **each** PostgREST request (not once at client
 * creation) so `getToken({ skipCache: true })` can return a fresh JWT after
 * refresh and long requests do not stick with an expired snapshot.
 */
export async function createClient() {
  const { getToken } = await auth();
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: async () => getClerkTokenForSupabase(getToken),
    },
  );
}
