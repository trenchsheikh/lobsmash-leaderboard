import { auth } from "@clerk/nextjs/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getClerkTokenForSupabase } from "@/lib/supabase/clerk-token";

/**
 * Server Supabase client authorized with the Clerk session JWT.
 * Uses @supabase/supabase-js with `accessToken` only — not @supabase/ssr's
 * createServerClient, which registers `onAuthStateChange` and is incompatible
 * with the accessToken option.
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
