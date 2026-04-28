"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireOnboarded } from "@/lib/auth/profile";
import { PROFILE_ATTRIBUTE_OPTIONS } from "@/lib/onboarding-options";
import { RATING_ATTRIBUTE_UI } from "@/lib/verification-attributes";
import { isDemoVerificationId, verificationMocksEnabled } from "@/lib/verification-mocks";

const COACH_DOC_MAX_BYTES = 5 * 1024 * 1024;
const COACH_DOC_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function extForCoachDocMime(mime: string): string | null {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

function friendlyCoachDocStorageError(message: string): string {
  if (/bucket not found/i.test(message)) {
    return (
      "Document storage is not set up yet. Ask your LobSmash admin to run the latest coach " +
      "migrations (see supabase/HOSTED_SETUP.md)."
    );
  }
  return message;
}

function parseRpcError(message: string): string {
  if (message.includes("coach is not approved")) return "That coach is not approved yet.";
  if (message.includes("invalid coach")) return "Pick a different coach.";
  if (message.includes("player profile missing")) return "Complete your player profile first.";
  if (message.includes("pending request already exists"))
    return "You already have a pending request with this coach.";
  if (message.includes("not cancellable")) return "Could not cancel that request.";
  if (message.includes("not an approved coach")) return "You are not an approved coach.";
  if (message.includes("not assigned")) return "You are not assigned to this request.";
  if (message.includes("not pending")) return "This request is no longer pending.";
  if (message.includes("attribute_scores")) return "Check all attribute ratings (1–8).";
  if (message.includes("unknown attribute")) return "Invalid attribute payload.";
  if (message.includes("attribute note too long")) return "A coach note is too long (max 600 characters per area).";
  if (message.includes("invalid attribute note")) return "Invalid coach note for an attribute.";
  if (message.includes("unknown attribute keys in notes")) return "Invalid coach notes payload.";
  if (message.includes("attribute notes required")) return "Add written feedback for every rating.";
  if (message.includes("attribute notes must include all six")) return "Add written feedback for every rating.";
  if (message.includes("missing attribute note for")) return "Add written feedback for every rating.";
  if (message.includes("empty attribute note for")) return "Feedback cannot be empty for any rating.";
  if (message.includes("slot is not available")) return "That session is no longer available.";
  if (message.includes("slot not found")) return "Session not found.";
  if (message.includes("cannot book your own")) return "You cannot book your own session.";
  if (message.includes("already started")) return "That session has already started.";
  return message || "Something went wrong.";
}

export async function createVerificationRequest(coachUserId: string) {
  const { supabase } = await requireOnboarded();
  const trimmed = coachUserId.trim();
  if (!trimmed) return { error: "Pick a coach." };

  const { data, error } = await supabase.rpc("create_verification_request", {
    p_coach_user_id: trimmed,
  });

  if (error) {
    return { error: parseRpcError(error.message) };
  }

  revalidatePath("/verification");
  revalidatePath("/profile");
  return { ok: true as const, requestId: data as string };
}

export async function cancelVerificationRequest(requestId: string) {
  const { supabase } = await requireOnboarded();
  const { error } = await supabase.rpc("cancel_verification_request", {
    p_request_id: requestId,
  });

  if (error) {
    return { error: parseRpcError(error.message) };
  }

  revalidatePath("/verification");
  revalidatePath("/profile");
  return { ok: true as const };
}

export async function submitCoachAssessment(
  requestId: string,
  scores: Record<string, number>,
  venue?: string,
  notes?: Record<string, string>,
) {
  const { supabase } = await requireOnboarded();

  const keys = PROFILE_ATTRIBUTE_OPTIONS.map((o) => o.value);
  const payload: Record<string, number> = {};
  for (const k of keys) {
    const n = scores[k];
    if (typeof n !== "number" || !Number.isFinite(n)) {
      return { error: "Each attribute needs a rating." };
    }
    const r = Math.round(n);
    if (r < 1 || r > 8) {
      return { error: "Ratings must be between 1 and 8." };
    }
    payload[k] = r;
  }

  const labelForKey = (k: string) =>
    RATING_ATTRIBUTE_UI.find((a) => a.value === k)?.label ?? k;

  const notePayload: Record<string, string> = {};
  for (const k of keys) {
    const t = (notes?.[k] ?? "").trim();
    if (t.length < 1) {
      return { error: `Add feedback for “${labelForKey(k)}” before submitting.` };
    }
    notePayload[k] = t.slice(0, 600);
  }

  const { data, error } = await supabase.rpc("submit_coach_assessment", {
    p_request_id: requestId,
    p_attribute_scores: payload,
    p_venue: venue?.trim() || null,
    p_attribute_notes: notePayload,
  });

  if (error) {
    return { error: parseRpcError(error.message) };
  }

  revalidatePath("/verification");
  revalidatePath("/verification/inbox");
  revalidatePath(`/verification/session/${requestId}`);
  revalidatePath("/profile");
  return { ok: true as const, assessmentId: data as string };
}

/**
 * Full coach listing application: bio, optional extra notes, club flag, and two documents
 * (credentials + ID) stored in private `coach_documents` bucket.
 */
export async function submitCoachListingApplication(formData: FormData) {
  const { supabase, user } = await requireOnboarded();

  const bio = String(formData.get("bio") ?? "").trim();
  const evidence = String(formData.get("evidence") ?? "").trim();
  const alreadyAtClub = formData.get("already_at_club") === "true";

  if (bio.length < 20) {
    return {
      error: "Please write at least a short paragraph about your coaching (20 characters or more).",
    };
  }

  const { data: existing } = await supabase
    .from("coach_profiles")
    .select("user_id, credential_document_path, identification_document_path")
    .eq("user_id", user.id)
    .maybeSingle();

  const prevCred = (existing?.credential_document_path as string | null) ?? null;
  const prevId = (existing?.identification_document_path as string | null) ?? null;

  const credFile = formData.get("credential_document");
  const idFile = formData.get("identification_document");

  const uploadDoc = async (
    field: File,
    kind: "credential" | "identification",
  ): Promise<{ path: string } | { error: string }> => {
    if (!(field instanceof File) || field.size === 0) {
      return { error: "Missing file." };
    }
    if (field.size > COACH_DOC_MAX_BYTES) {
      return { error: "Each file must be 5MB or smaller." };
    }
    if (!COACH_DOC_MIMES.has(field.type)) {
      return { error: "Use PDF, JPEG, PNG, or WebP for uploads." };
    }
    const ext = extForCoachDocMime(field.type);
    if (!ext) return { error: "Unsupported file type." };
    const path = `${user.id}/${kind}-${randomUUID()}.${ext}`;
    const buf = Buffer.from(await field.arrayBuffer());
    const { error: upErr } = await supabase.storage.from("coach_documents").upload(path, buf, {
      contentType: field.type,
      upsert: false,
    });
    if (upErr) return { error: friendlyCoachDocStorageError(upErr.message) };
    return { path };
  };

  let newCredPath: string | null = null;
  let newIdPath: string | null = null;

  if (credFile instanceof File && credFile.size > 0) {
    const r = await uploadDoc(credFile, "credential");
    if ("error" in r) return r;
    newCredPath = r.path;
  }

  if (idFile instanceof File && idFile.size > 0) {
    const r = await uploadDoc(idFile, "identification");
    if ("error" in r) {
      if (newCredPath) {
        await supabase.storage.from("coach_documents").remove([newCredPath]);
      }
      return r;
    }
    newIdPath = r.path;
  }

  const finalCredPath = newCredPath ?? prevCred;
  const finalIdPath = newIdPath ?? prevId;

  if (!finalCredPath || !finalIdPath) {
    if (newCredPath) await supabase.storage.from("coach_documents").remove([newCredPath]);
    if (newIdPath) await supabase.storage.from("coach_documents").remove([newIdPath]);
    return {
      error:
        "Please upload both documents: proof of coaching credentials and a photo or scan of your ID.",
    };
  }

  const row = {
    bio,
    evidence_note: evidence || null,
    already_at_club: alreadyAtClub,
    credential_document_path: finalCredPath,
    identification_document_path: finalIdPath,
  };

  try {
    if (existing?.user_id) {
      const { error } = await supabase.from("coach_profiles").update(row).eq("user_id", user.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("coach_profiles").insert({
        user_id: user.id,
        ...row,
      });
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    if (newCredPath) await supabase.storage.from("coach_documents").remove([newCredPath]);
    if (newIdPath) await supabase.storage.from("coach_documents").remove([newIdPath]);
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    return { error: msg };
  }

  if (newCredPath && prevCred && newCredPath !== prevCred) {
    await supabase.storage.from("coach_documents").remove([prevCred]);
  }
  if (newIdPath && prevId && newIdPath !== prevId) {
    await supabase.storage.from("coach_documents").remove([prevId]);
  }

  revalidatePath("/verification");
  revalidatePath("/become-a-coach");
  return { ok: true as const };
}

export async function bookVerificationSlot(slotId: string) {
  const { supabase } = await requireOnboarded();
  const id = slotId.trim();
  if (!id) return { error: "Pick a session." };

  /** Dev/preview: demo slot ids are not in Postgres — simulate a successful book. */
  if (verificationMocksEnabled() && isDemoVerificationId(id)) {
    revalidatePath("/verification");
    return { ok: true as const, mock: true as const, requestId: "demo-request" };
  }

  const { data, error } = await supabase.rpc("book_verification_slot", {
    p_slot_id: id,
  });

  if (error) {
    return { error: parseRpcError(error.message) };
  }

  const newRequestId = data as string;
  revalidatePath("/verification");
  revalidatePath(`/verification/session/${newRequestId}`);
  revalidatePath("/profile");
  return { ok: true as const, requestId: newRequestId };
}

export async function createCoachVerificationSlot(input: {
  venue: string;
  startsAtIso: string;
  durationMinutes: number;
  notes?: string;
}) {
  const { supabase, user } = await requireOnboarded();

  const venue = input.venue.trim();
  if (venue.length < 2) return { error: "Add a venue (at least 2 characters)." };

  const start = new Date(input.startsAtIso);
  if (Number.isNaN(start.getTime())) return { error: "Pick a valid start time." };
  if (start.getTime() < Date.now() + 60_000) {
    return { error: "Start time must be at least one minute from now." };
  }

  const d = Math.round(input.durationMinutes);
  if (!Number.isFinite(d) || d < 15 || d > 480) {
    return { error: "Duration must be between 15 and 480 minutes." };
  }

  const { data: coach } = await supabase
    .from("coach_profiles")
    .select("approved_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!coach?.approved_at) {
    return { error: "You need to be an approved coach to publish sessions." };
  }

  const notes = input.notes?.trim() || null;

  const { error } = await supabase.from("coach_verification_slots").insert({
    coach_user_id: user.id,
    venue,
    starts_at: start.toISOString(),
    duration_minutes: d,
    notes,
    status: "open",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/verification");
  return { ok: true as const };
}

export async function cancelCoachVerificationSlot(slotId: string) {
  const { supabase, user } = await requireOnboarded();
  const id = slotId.trim();
  if (!id) return { error: "Missing session." };

  const { data, error } = await supabase
    .from("coach_verification_slots")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("coach_user_id", user.id)
    .eq("status", "open")
    .select("id");

  if (error) {
    return { error: error.message };
  }
  if (!data?.length) {
    return { error: "Could not cancel (already booked or not found)." };
  }

  revalidatePath("/verification");
  return { ok: true as const };
}

