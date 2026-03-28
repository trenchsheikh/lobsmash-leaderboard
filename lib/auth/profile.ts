import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PgError = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

function describeSupabaseError(error: PgError | null): string {
  if (!error) return "unknown error";
  const msg = [error.message, error.code, error.details, error.hint]
    .filter((s) => s != null && String(s).length > 0)
    .join(" | ");
  if (msg) return msg;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function ensureProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (data) return;

  const { error } = await supabase.from("users").insert({ id: userId });

  if (error?.code === "23505") {
    const { data: row } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (row) return;
  }

  if (error) {
    const desc = describeSupabaseError(error);
    console.error("ensureProfile insert failed", desc, error);
    const msg = error.message ?? "";
    if (
      error.code === "22P02" ||
      msg.includes("invalid input syntax for type uuid")
    ) {
      throw new Error(
        "Database still expects UUID user ids. In Supabase → SQL Editor, run supabase/migrations/20250328120000_clerk_jwt_text_ids.sql (see supabase/HOSTED_SETUP.md).",
      );
    }
    if (
      error.code === "42501" ||
      /permission denied|row-level security/i.test(msg)
    ) {
      throw new Error(
        "Supabase rejected creating your profile (RLS). Confirm Third-party Auth → Clerk is enabled, session tokens include the role claim (Connect with Supabase), and migrations with private.request_uid() are applied.",
      );
    }
    throw new Error(
      `Could not create your profile: ${desc}. Check Supabase RLS and migrations (see supabase/HOSTED_SETUP.md).`,
    );
  }
}

/** Dedupes session + Supabase client setup within a single RSC request. */
const requireUserCached = cache(async () => {
  const { userId } = await auth();
  if (!userId) redirect("/login");
  const supabase = await createClient();
  await ensureProfile(supabase, userId);
  return { supabase, user: { id: userId } };
});

export async function requireUser() {
  return requireUserCached();
}

/** Dedupes profile/player reads when multiple server components call it in one request. */
export const getOnboardingState = cache(async () => {
  const { supabase, user } = await requireUserCached();
  const { data: profile } = await supabase
    .from("users")
    .select("name, username, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const { data: player } = await supabase
    .from("players")
    .select(
      "id, name, playstyle, strengths, weaknesses, preferred_side, experience_level",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  const complete =
    Boolean(profile?.name?.trim()) &&
    Boolean(profile?.username?.trim()) &&
    Boolean(player);
  return { supabase, user, profile, player, complete };
});

export async function requireOnboarded() {
  const state = await getOnboardingState();
  if (!state.complete) redirect("/onboarding");
  return state;
}
