"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/profile";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const usernameRaw = String(formData.get("username") ?? "");
  const username = normalizeUsername(usernameRaw);

  const playstyle = String(formData.get("playstyle") ?? "").trim();
  const preferredSide = String(formData.get("preferred_side") ?? "").trim();
  const experienceLevel = String(formData.get("experience_level") ?? "").trim();
  const strengths = formData.getAll("strengths").map(String);
  const weaknesses = formData.getAll("weaknesses").map(String);

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
    playstyle: playstyle || null,
    strengths,
    weaknesses,
    preferred_side: preferredSide || null,
    experience_level: experienceLevel || null,
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
