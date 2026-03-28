"use client";

import { useAuth } from "@clerk/nextjs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import { getClerkTokenForSupabase } from "@/lib/supabase/clerk-token";

/** Browser Supabase client with Clerk JWT for RLS (use in client components). */
export function useSupabaseBrowser() {
  const { getToken } = useAuth();
  return useMemo(
    () =>
      createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          accessToken: async () => getClerkTokenForSupabase(getToken),
        },
      ),
    [getToken],
  );
}
