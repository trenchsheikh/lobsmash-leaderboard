import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Before mutating results for a completed session, undo that session's skill contribution
 * so {@link applySkillRatingAfterCompletedEdit} can re-apply from updated rows.
 */
export async function reverseSkillRatingIfCompleted(
  supabase: SupabaseClient,
  sessionId: string,
  wasCompleted: boolean,
): Promise<string | undefined> {
  if (!wasCompleted) return undefined;
  const { error } = await supabase.rpc("reverse_skill_rating_for_session", {
    p_session_id: sessionId,
  });
  if (error) return error.message;
  return undefined;
}

/** Re-apply skill model after results change (session must still be `completed`). */
export async function applySkillRatingAfterCompletedEdit(
  supabase: SupabaseClient,
  sessionId: string,
  isCompleted: boolean,
): Promise<string | undefined> {
  if (!isCompleted) return undefined;
  const { error } = await supabase.rpc("apply_skill_rating_for_session", {
    p_session_id: sessionId,
  });
  if (error) return error.message;
  return undefined;
}
