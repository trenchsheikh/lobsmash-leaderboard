import { createClient } from "@supabase/supabase-js";

/** Supabase client without Clerk JWT (anon role). Used for public RPCs granted to `anon`. */
export function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
