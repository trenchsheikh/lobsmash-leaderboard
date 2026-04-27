"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/profile";
import { PROFILE_ATTRIBUTE_OPTIONS } from "@/lib/onboarding-options";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const usernameRaw = String(formData.get("username") ?? "");
  const username = normalizeUsername(usernameRaw);

  const preferredSide = String(formData.get("preferred_side") ?? "").trim();
  const experienceLevel = String(formData.get("experience_level") ?? "").trim();
  const playstyle = String(formData.get("playstyle") ?? "").trim();
  const playStyles = formData.getAll("strengths").map(String).filter(Boolean);
  if (playstyle) playStyles.unshift(playstyle);
  const uniquePlayStyles = Array.from(new Set(playStyles));

  const profileAttributes: Record<string, number> = {};
  let hasAnyAttribute = false;
  for (const attr of PROFILE_ATTRIBUTE_OPTIONS) {
    const raw = formData.get(`rating_${attr.value}`);
    if (raw == null) continue;
    const n = Number(raw);
    profileAttributes[attr.value] = Number.isFinite(n)
      ? Math.max(1, Math.min(8, Math.round(n)))
      : 1;
    hasAnyAttribute = true;
  }
  const improvementAreas = formData
    .getAll("improvement_areas")
    .map(String)
    .filter(Boolean)
    .slice(0, 4);
  const cityOrPostcode = String(formData.get("city_or_postcode") ?? "").trim();
  const rawTravel = String(formData.get("travel_distance_km") ?? "").trim().toLowerCase();
  const travelDistanceKm =
    rawTravel === ""
      ? null
      : rawTravel === "any"
        ? null
        : (() => {
            const n = Number(rawTravel);
            return Number.isFinite(n) ? Math.max(1, Math.round(n)) : null;
          })();
  const usualPlayTimes = formData
    .getAll("usual_play_times")
    .map(String)
    .filter(Boolean);

  if (!name) return { error: "Display name is required." };

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
  if (availability === "empty") {
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

  if (!existing) {
    return { error: "Player profile missing. Complete onboarding first." };
  }

  const playerPayload = {
    name,
    preferred_side: preferredSide || null,
    experience_level: experienceLevel || null,
    ...(uniquePlayStyles.length > 0 ? { play_styles: uniquePlayStyles } : {}),
    ...(hasAnyAttribute ? { profile_attributes: profileAttributes } : {}),
    ...(improvementAreas.length > 0 ? { improvement_areas: improvementAreas } : {}),
    ...(cityOrPostcode ? { city_or_postcode: cityOrPostcode } : {}),
    ...(rawTravel ? { travel_distance_km: travelDistanceKm } : {}),
    ...(usualPlayTimes.length > 0 ? { usual_play_times: usualPlayTimes } : {}),
  };

  const { error: playerErr } = await supabase
    .from("players")
    .update(playerPayload)
    .eq("id", existing.id);

  if (playerErr) return { error: playerErr.message };

  revalidatePath("/", "layout");
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteProfile() {
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("delete_my_profile");
  if (error) {
    if (error.code === "23503") {
      return { error: "You still own league data. Transfer ownership or delete those leagues first." };
    }
    return { error: error.message || "Could not delete your profile right now." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}
