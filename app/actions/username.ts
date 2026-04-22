"use server";

import { requireUser } from "@/lib/auth/profile";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

export type UsernameCheckResult =
  | { status: "empty" }
  | { status: "invalid"; message: string }
  | { status: "available"; normalized: string }
  | { status: "taken"; normalized: string }
  | { status: "yours"; normalized: string }
  | { status: "error"; message: string };

/**
 * Check whether a candidate username is free.
 *
 * Uses the `public.check_username_availability` SECURITY DEFINER RPC so the
 * existence check is global and not filtered by RLS on `public.users`. The DB
 * still enforces uniqueness via the `users_username_lower_unique` index — this
 * is a UX helper on top of that hard guarantee, not a replacement for it.
 */
export async function checkUsernameAvailability(
  raw: string,
): Promise<UsernameCheckResult> {
  const normalized = normalizeUsername(raw);
  if (!normalized) return { status: "empty" };

  const formatErr = validateUsernameFormat(normalized);
  if (formatErr) return { status: "invalid", message: formatErr };

  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("check_username_availability", {
    p_username: normalized,
  });

  if (error) {
    return { status: "error", message: "Could not check username. Try again." };
  }

  switch (data) {
    case "available":
      return { status: "available", normalized };
    case "yours":
      return { status: "yours", normalized };
    case "taken":
      return { status: "taken", normalized };
    case "empty":
      return { status: "empty" };
    default:
      return {
        status: "error",
        message: "Could not check username. Try again.",
      };
  }
}
