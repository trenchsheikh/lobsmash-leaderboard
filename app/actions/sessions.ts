"use server";

import { revalidatePath } from "next/cache";
import { requireOnboarded } from "@/lib/auth/profile";
import {
  completeSession as completeSessionWizard,
  type SessionWizardMeta,
} from "@/app/actions/session-wizard";

export async function createSession(leagueId: string, formData: FormData) {
  const { supabase, user } = await requireOnboarded();
  const dateRaw = String(formData.get("date") ?? "").trim();

  if (!dateRaw) return { error: "Date is required." };

  const { data: league, error: lErr } = await supabase
    .from("leagues")
    .select("id")
    .eq("id", leagueId)
    .maybeSingle();

  if (lErr || !league) return { error: "League not found." };

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      league_id: leagueId,
      created_by: user.id,
      date: dateRaw,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/leagues/${leagueId}`);
  return { sessionId: data.id as string };
}

export async function completeSession(
  leagueId: string,
  sessionId: string,
  meta?: SessionWizardMeta,
) {
  return completeSessionWizard(leagueId, sessionId, meta);
}

export async function deleteSession(leagueId: string, sessionId: string) {
  const { supabase } = await requireOnboarded();

  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}
