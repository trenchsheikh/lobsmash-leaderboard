"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/profile";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_BYTES = 2 * 1024 * 1024;

function extForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "gif";
}

function friendlyStorageError(message: string): string {
  if (/bucket not found/i.test(message)) {
    return (
      "The avatars storage bucket is missing. In Supabase → SQL Editor, run " +
      "migration 20260328120000_user_avatar_storage.sql (see supabase/HOSTED_SETUP.md)."
    );
  }
  return message;
}

export async function uploadAvatar(formData: FormData) {
  const { supabase, user } = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided." };
  if (file.size > MAX_BYTES) return { error: "Image must be 2MB or smaller." };
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return { error: "Use JPEG, PNG, WebP, or GIF." };
  }

  const ext = extForMime(file.type);
  const path = `${user.id}/avatar.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from("avatars").upload(path, buf, {
    contentType: file.type,
    upsert: true,
  });

  if (upErr) return { error: friendlyStorageError(upErr.message) };

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const { error: dbErr } = await supabase
    .from("users")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (dbErr) return { error: dbErr.message };

  revalidatePath("/", "layout");
  return { ok: true as const, url: publicUrl };
}

export async function removeAvatar() {
  const { supabase, user } = await requireUser();
  const { data: row } = await supabase
    .from("users")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const oldUrl = row?.avatar_url as string | null | undefined;
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")}/storage/v1/object/public/avatars/`;
  if (oldUrl && base && oldUrl.startsWith(base)) {
    const objectPath = oldUrl.slice(base.length);
    const { error: rmErr } = await supabase.storage.from("avatars").remove([objectPath]);
    if (rmErr) console.error("removeAvatar storage remove", rmErr.message);
  }

  const { error: dbErr } = await supabase.from("users").update({ avatar_url: null }).eq("id", user.id);
  if (dbErr) return { error: dbErr.message };

  revalidatePath("/", "layout");
  return { ok: true as const };
}
