"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  EXPERIENCE_OPTIONS,
  PLAYSTYLE_OPTIONS,
  PREFERRED_SIDE_OPTIONS,
  STRENGTH_OPTIONS,
  WEAKNESS_OPTIONS,
} from "@/lib/onboarding-options";
import { ProfileAvatarField } from "@/components/profile-avatar-field";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

export type ProfileEditDefaults = {
  name: string;
  username: string;
  avatar_url: string | null;
  playstyle: string | null;
  preferred_side: string | null;
  experience_level: string | null;
  strengths: string[];
  weaknesses: string[];
};

const STRENGTH_ALLOWED = new Set<string>(STRENGTH_OPTIONS.map((o) => o.value));
const WEAKNESS_ALLOWED = new Set<string>(WEAKNESS_OPTIONS.map((o) => o.value));

export function ProfileEditSheet({ defaults }: { defaults: ProfileEditDefaults }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [username, setUsername] = useState(defaults.username);
  const [name, setName] = useState(defaults.name);
  const [playstyle, setPlaystyle] = useState(defaults.playstyle ?? "");
  const [preferredSide, setPreferredSide] = useState(defaults.preferred_side ?? "");
  const [experienceLevel, setExperienceLevel] = useState(
    defaults.experience_level ?? "",
  );
  const [strengths, setStrengths] = useState<Set<string>>(() => {
    return new Set(
      (defaults.strengths as string[]).filter((s) => STRENGTH_ALLOWED.has(s)),
    );
  });
  const [weaknesses, setWeaknesses] = useState<Set<string>>(() => {
    return new Set(
      (defaults.weaknesses as string[]).filter((w) => WEAKNESS_ALLOWED.has(w)),
    );
  });
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setUsername(defaults.username);
    setName(defaults.name);
    setPlaystyle(defaults.playstyle ?? "");
    setPreferredSide(defaults.preferred_side ?? "");
    setExperienceLevel(defaults.experience_level ?? "");
    setStrengths(
      new Set(
        (defaults.strengths as string[]).filter((s) => STRENGTH_ALLOWED.has(s)),
      ),
    );
    setWeaknesses(
      new Set(
        (defaults.weaknesses as string[]).filter((w) => WEAKNESS_ALLOWED.has(w)),
      ),
    );
    setError(null);
  }, [defaults]);

  function toggleInSet(
    set: Set<string>,
    updater: (s: Set<string>) => void,
    value: string,
  ) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    updater(next);
  }

  function validate(): string | null {
    if (!name.trim()) return "Add a display name.";
    const u = normalizeUsername(username);
    const uErr = validateUsernameFormat(u);
    if (uErr) return uErr;
    if (!playstyle) return "Pick a playstyle.";
    if (strengths.size === 0) return "Pick at least one strength.";
    if (weaknesses.size === 0) return "Pick at least one area to grow.";
    if (!preferredSide) return "Choose your preferred side.";
    if (!experienceLevel) return "Pick your experience level.";
    return null;
  }

  function submit() {
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    const fd = new FormData();
    fd.set("username", normalizeUsername(username));
    fd.set("name", name.trim());
    fd.set("playstyle", playstyle);
    fd.set("preferred_side", preferredSide);
    fd.set("experience_level", experienceLevel);
    for (const s of strengths) fd.append("strengths", s);
    for (const w of weaknesses) fd.append("weaknesses", w);

    start(async () => {
      const res = await updateProfile(fd);
      if ("error" in res && res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Profile updated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="gap-2"
          >
            <Pencil className="size-4" aria-hidden />
            Edit profile
          </Button>
        }
      />
      <DialogContent
        showCloseButton
        className={cn(
          "fixed top-0 right-0 left-auto h-full max-h-[100dvh] max-w-xl translate-x-0 translate-y-0 rounded-none border-r-0 border-t-0 border-b-0 sm:rounded-l-xl",
          "flex flex-col gap-0 overflow-hidden p-0 sm:max-w-xl",
        )}
      >
        <div className="border-b border-border/80 bg-muted/30 px-4 py-4 sm:px-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Edit profile</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Update how you appear in leagues and sessions.
            </p>
          </DialogHeader>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-8 pb-8">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="mb-3 text-sm font-medium">Photo</p>
              <ProfileAvatarField
                name={name.trim() || "Player"}
                username={username.trim() ? normalizeUsername(username) : null}
                avatarUrl={defaults.avatar_url}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="padel_ninja"
                className="font-mono lowercase"
                maxLength={24}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Display name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
                placeholder="Alex"
              />
            </div>
            <div className="space-y-3">
              <Label>Playstyle</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {PLAYSTYLE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setPlaystyle(o.value)}
                    className={cn(
                      "rounded-xl border-2 p-3 text-left text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      playstyle === o.value
                        ? "border-primary bg-primary/5"
                        : "border-border/80 bg-card",
                    )}
                  >
                    <span className="font-medium">{o.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {o.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Strengths</Label>
              <div className="flex flex-wrap gap-2">
                {STRENGTH_OPTIONS.map((o) => {
                  const on = strengths.has(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleInSet(strengths, setStrengths, o.value)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/80 bg-muted/40 hover:bg-muted",
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Areas to grow</Label>
              <div className="flex flex-wrap gap-2">
                {WEAKNESS_OPTIONS.map((o) => {
                  const on = weaknesses.has(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleInSet(weaknesses, setWeaknesses, o.value)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        on
                          ? "border-amber-600/80 bg-amber-500/15 dark:border-amber-500/60"
                          : "border-border/80 bg-muted/40 hover:bg-muted",
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Preferred side</Label>
              <div className="grid gap-2">
                {PREFERRED_SIDE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setPreferredSide(o.value)}
                    className={cn(
                      "rounded-xl border-2 p-3 text-left text-sm transition-colors",
                      preferredSide === o.value
                        ? "border-primary bg-primary/5"
                        : "border-border/80 bg-card",
                    )}
                  >
                    <span className="font-medium">{o.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {o.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Experience</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {EXPERIENCE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setExperienceLevel(o.value)}
                    className={cn(
                      "rounded-xl border-2 p-3 text-left text-sm transition-colors",
                      experienceLevel === o.value
                        ? "border-primary bg-primary/5"
                        : "border-border/80 bg-card",
                    )}
                  >
                    <span className="font-medium">{o.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {o.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
        <div className="border-t border-border/80 bg-muted/30 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={submit}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
