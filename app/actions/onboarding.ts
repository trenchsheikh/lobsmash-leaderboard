"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/profile";
import {
  inviteUuidFromJoinPath,
  isSafeJoinRedirectPath,
  isSafePostAuthRedirectPath,
  leagueCodeFromJoinPath,
} from "@/lib/safe-redirect-url";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";
import { PROFILE_ATTRIBUTE_OPTIONS } from "@/lib/onboarding-options";

export async function completeOnboarding(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const preferredSide = String(formData.get("preferred_side") ?? "").trim();
  const experienceLevel = String(formData.get("experience_level") ?? "").trim();
  const playStyles = formData.getAll("strengths").map(String).filter(Boolean);
  const improvementAreas = formData
    .getAll("improvement_areas")
    .map(String)
    .filter(Boolean)
    .slice(0, 4);
  const cityOrPostcode = String(formData.get("city_or_postcode") ?? "").trim();
  const rawTravel = String(formData.get("travel_distance_km") ?? "10").trim().toLowerCase();
  const travelDistanceKm =
    rawTravel === "any"
      ? null
      : (() => {
          const n = Number(rawTravel);
          return Number.isFinite(n) ? Math.max(1, Math.round(n)) : 10;
        })();
  const usualPlayTimes = formData
    .getAll("usual_play_times")
    .map(String)
    .filter(Boolean);
  const attributeRatings: Record<string, number> = {};
  for (const attr of PROFILE_ATTRIBUTE_OPTIONS) {
    const raw = Number(formData.get(`rating_${attr.value}`) ?? 1);
    const bounded = Number.isFinite(raw) ? Math.max(1, Math.min(8, Math.round(raw))) : 1;
    attributeRatings[attr.value] = bounded;
  }

  if (
    !name ||
    !preferredSide ||
    !experienceLevel ||
    playStyles.length === 0 ||
    !cityOrPostcode ||
    usualPlayTimes.length === 0
  ) {
    return { error: "Please fill all required fields." };
  }

  const uErr = validateUsernameFormat(username);
  if (uErr) return { error: uErr };

  const { data: availability, error: availErr } = await supabase.rpc(
    "check_username_availability",
    { p_username: username },
  );
  if (availErr) {
    return { error: "Could not verify that username. Try again." };
  }
  if (availability === "taken") {
    return { error: "That username is already taken." };
  }
  if (availability === "invalid" || availability === "empty") {
    return { error: "Pick a valid username." };
  }

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
    preferred_side: preferredSide,
    experience_level: experienceLevel,
    play_styles: playStyles,
    profile_attributes: attributeRatings,
    improvement_areas: improvementAreas,
    city_or_postcode: cityOrPostcode,
    travel_distance_km: travelDistanceKm,
    usual_play_times: usualPlayTimes,
  };

  const { error: playerErr } = existing
    ? await supabase.from("players").update(payload).eq("id", existing.id)
    : await supabase.from("players").insert(payload);

  if (playerErr) return { error: playerErr.message };

  const redirectRaw = String(formData.get("redirect_url") ?? "").trim();
  let redirectTo: string = "/dashboard";
  if (isSafePostAuthRedirectPath(redirectRaw)) {
    redirectTo = redirectRaw;
    if (isSafeJoinRedirectPath(redirectRaw)) {
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
    }
    revalidatePath(redirectRaw);
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  return { ok: true as const, redirectTo };
}
