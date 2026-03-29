"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/profile";
import {
  inviteUuidFromJoinPath,
  isSafeJoinRedirectPath,
  leagueCodeFromJoinPath,
} from "@/lib/safe-redirect-url";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

export async function completeOnboarding(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const playstyle = String(formData.get("playstyle") ?? "").trim();
  const preferredSide = String(formData.get("preferred_side") ?? "").trim();
  const experienceLevel = String(formData.get("experience_level") ?? "").trim();

  const strengths = formData.getAll("strengths").map(String);
  const weaknesses = formData.getAll("weaknesses").map(String);

  if (!name || !playstyle || !preferredSide || !experienceLevel) {
    return { error: "Please fill all required fields." };
  }

  const uErr = validateUsernameFormat(username);
  if (uErr) return { error: uErr };

  const { data: taken } = await supabase
    .from("users")
    .select("id")
    .eq("username", username)
    .neq("id", user.id)
    .maybeSingle();

  if (taken) return { error: "That username is already taken." };

  const { error: userErr } = await supabase
    .from("users")
    .update({ name, username })
    .eq("id", user.id);

  if (userErr) {
    if (userErr.code === "23505") return { error: "That username is already taken." };
    return { error: userErr.message };
  }

  const { data: existing } = await supabase
    .from("players")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const payload = {
    user_id: user.id,
    name,
    playstyle,
    strengths,
    weaknesses,
    preferred_side: preferredSide,
    experience_level: experienceLevel,
  };

  const { error: playerErr } = existing
    ? await supabase.from("players").update(payload).eq("id", existing.id)
    : await supabase.from("players").insert(payload);

  if (playerErr) return { error: playerErr.message };

  const redirectRaw = String(formData.get("redirect_url") ?? "").trim();
  let redirectTo: string = "/dashboard";
  if (isSafeJoinRedirectPath(redirectRaw)) {
    redirectTo = redirectRaw;
    const code = leagueCodeFromJoinPath(redirectRaw);
    if (code) {
      await supabase.rpc("join_league_by_code", { p_code: code });
    } else {
      const uuid = inviteUuidFromJoinPath(redirectRaw);
      if (uuid) {
        await supabase.rpc("request_join_league_by_invite_token", {
          p_invite_token: uuid,
        });
      }
    }
    revalidatePath(redirectRaw);
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  return { ok: true as const, redirectTo };
}
