"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeOnboarding } from "@/app/actions/onboarding";
import { updateProfile } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
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
import { Camera, Gauge, UserCircle } from "lucide-react";
import { ProfileAvatarField } from "@/components/profile-avatar-field";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

function pickInitialUsername(d: OnboardingFlowDefaults | undefined): string {
  return d?.username?.trim() ?? "";
}

export type OnboardingFlowDefaults = {
  username?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  playstyle?: string | null;
  preferred_side?: string | null;
  experience_level?: string | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
};

type StepId =
  | "intro"
  | "username"
  | "name"
  | "avatar"
  | "playstyle"
  | "strengths"
  | "weaknesses"
  | "preferred_side"
  | "experience";

const ALL_STEPS: StepId[] = [
  "intro",
  "username",
  "name",
  "avatar",
  "playstyle",
  "strengths",
  "weaknesses",
  "preferred_side",
  "experience",
];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

type OnboardingFlowProps = {
  defaults?: OnboardingFlowDefaults;
  variant: "onboarding" | "profile";
  /** Shown above the flow on profile (e.g. email). */
  accountSlot?: React.ReactNode;
};

export function OnboardingFlow({
  defaults,
  variant,
  accountSlot,
}: OnboardingFlowProps) {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const [pending, startTransition] = useTransition();
  const stepStackRef = useRef<HTMLDivElement>(null);

  const steps = useMemo(
    () =>
      variant === "onboarding"
        ? ALL_STEPS
        : ALL_STEPS.filter((s) => s !== "intro"),
    [variant],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const stepId = steps[stepIndex] ?? "intro";

  const [username, setUsername] = useState(() => pickInitialUsername(defaults));
  const [name, setName] = useState(defaults?.name?.trim() ?? "");
  const [playstyle, setPlaystyle] = useState(defaults?.playstyle ?? "");
  const [preferredSide, setPreferredSide] = useState(defaults?.preferred_side ?? "");
  const [experienceLevel, setExperienceLevel] = useState(
    defaults?.experience_level ?? "",
  );
  const [strengths, setStrengths] = useState<Set<string>>(() => {
    const allowed = new Set<string>(STRENGTH_OPTIONS.map((o) => o.value));
    return new Set(
      (defaults?.strengths ?? []).filter((s) => allowed.has(s)),
    );
  });
  const [weaknesses, setWeaknesses] = useState<Set<string>>(() => {
    const allowed = new Set<string>(WEAKNESS_OPTIONS.map((o) => o.value));
    return new Set(
      (defaults?.weaknesses ?? []).filter((w) => allowed.has(w)),
    );
  });
  const [error, setError] = useState<string | null>(null);

  const progress = ((stepIndex + 1) / steps.length) * 100;

  const canGoBack = stepIndex > 0;
  const goBack = useCallback(() => {
    setError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setError(null);
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  }, [steps.length]);

  useEffect(() => {
    stepStackRef.current?.focus();
  }, [stepIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && canGoBack) {
        e.preventDefault();
        goBack();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canGoBack, goBack]);

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

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("username", username.trim().toLowerCase());
    fd.set("name", name.trim());
    fd.set("playstyle", playstyle);
    fd.set("preferred_side", preferredSide);
    fd.set("experience_level", experienceLevel);
    for (const s of strengths) fd.append("strengths", s);
    for (const w of weaknesses) fd.append("weaknesses", w);
    return fd;
  }

  function validateCurrent(): string | null {
    switch (stepId) {
      case "intro":
        return null;
      case "username": {
        const u = normalizeUsername(username);
        return validateUsernameFormat(u);
      }
      case "name":
        return name.trim() ? null : "Add a display name.";
      case "avatar":
        return null;
      case "playstyle":
        return playstyle ? null : "Pick the style that fits you best.";
      case "strengths":
        return strengths.size > 0 ? null : "Pick at least one strength.";
      case "weaknesses":
        return weaknesses.size > 0 ? null : "Pick at least one area to grow.";
      case "preferred_side":
        return preferredSide ? null : "Choose your preferred side.";
      case "experience":
        return experienceLevel ? null : "Tell us your experience level.";
      default:
        return null;
    }
  }

  function handlePrimary() {
    const v = validateCurrent();
    if (v) {
      setError(v);
      return;
    }
    if (stepIndex < steps.length - 1) {
      goNext();
      return;
    }
    const fd = buildFormData();
    startTransition(async () => {
      setError(null);
      if (variant === "onboarding") {
        const res = await completeOnboarding(fd);
        if (res && "error" in res && res.error) {
          setError(res.error);
          return;
        }
        router.push("/dashboard");
        router.refresh();
        return;
      }
      const res = await updateProfile(fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Profile saved");
      router.refresh();
    });
  }

  const stepEnterClass = reducedMotion
    ? ""
    : "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:ease-out";

  const isLast = stepIndex === steps.length - 1;
  const primaryLabel =
    stepId === "intro"
      ? "Let’s go"
      : isLast
        ? variant === "onboarding"
          ? "Finish & enter LobSmash"
          : "Save profile"
        : "Continue";

  const primaryBtnMotion = cn(
    "relative overflow-hidden rounded-xl font-semibold shadow-md",
    "transition-[color,transform,box-shadow,filter] duration-200 ease-out",
    reducedMotion
      ? "active:scale-[0.98]"
      : [
          "motion-safe:active:scale-[0.97]",
          "motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-xl motion-safe:hover:brightness-[1.03]",
          "motion-safe:hover:ring-2 motion-safe:hover:ring-primary/35",
          "motion-safe:focus-visible:ring-2 motion-safe:focus-visible:ring-ring motion-safe:focus-visible:ring-offset-2",
          "motion-safe:before:pointer-events-none motion-safe:before:absolute motion-safe:before:inset-0 motion-safe:before:-translate-x-full motion-safe:before:bg-gradient-to-r motion-safe:before:from-transparent motion-safe:before:via-white/25 motion-safe:before:to-transparent motion-safe:hover:before:translate-x-full motion-safe:before:transition-transform motion-safe:before:duration-500",
        ],
  );

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col overflow-x-hidden py-2">
      {accountSlot ? (
        <div className="mb-6 border-b border-border/60 pb-4">{accountSlot}</div>
      ) : null}

      <div
        className="mb-4"
        role="group"
        aria-label={variant === "onboarding" ? "Onboarding progress" : "Profile progress"}
      >
        {canGoBack ? (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={goBack}
              className="text-xs text-muted-foreground underline-offset-4 transition-colors duration-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Back
            </button>
          </div>
        ) : null}
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-valuetext={`Step ${stepIndex + 1} of ${steps.length}`}
        >
          <div
            className={cn(
              "h-full rounded-full bg-primary ease-out",
              reducedMotion ? "" : "transition-[width] duration-300",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div
        ref={stepStackRef}
        tabIndex={-1}
        className="flex flex-col outline-none"
        aria-live="polite"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === "TEXTAREA") return;
            e.preventDefault();
            handlePrimary();
          }
        }}
      >
        <div key={stepId} className={cn("flex flex-col", stepEnterClass)}>
        {stepId === "intro" ? (
          <div className="w-full space-y-3">
            <div className="min-w-0">
              <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
                Your LobSmash profile
              </h1>
              <p className="mt-2 text-sm leading-snug text-muted-foreground">
                <span className="sm:hidden">
                  Quick steps so teammates know you in leagues. Tap{" "}
                  <span className="font-medium text-foreground">Let&apos;s go</span> to start.
                </span>
                <span className="hidden sm:inline">
                  A short setup so teammates recognize you in draws and lineups. Tap{" "}
                  <span className="font-medium text-foreground">Let&apos;s go</span> when
                  you&apos;re ready—you can edit everything later in settings.
                </span>
              </p>
            </div>

            <ul className="space-y-1.5 rounded-lg border border-border/70 bg-muted/30 p-2.5 text-[13px] leading-tight text-foreground/90 sm:space-y-2 sm:text-sm sm:leading-snug">
              <li className="flex gap-2">
                <UserCircle
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-foreground">Profile</span>
                  <span className="text-muted-foreground"> — handle, name, photo</span>
                </span>
              </li>
              <li className="flex gap-2">
                <Camera className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="font-medium text-foreground">How you play</span>
                  <span className="text-muted-foreground"> — style &amp; strengths</span>
                </span>
              </li>
              <li className="flex gap-2">
                <Gauge className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="font-medium text-foreground">Lineups</span>
                  <span className="text-muted-foreground"> — side &amp; level</span>
                </span>
              </li>
            </ul>

            <p className="hidden text-xs text-muted-foreground sm:block">
              Honest picks help fair matchups—edit anytime in settings.
            </p>
          </div>
        ) : null}

        {stepId === "username" ? (
          <>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Pick a handle
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Lowercase, no spaces—your league ID.</p>
            <div className="mt-4 space-y-2">
              <Label htmlFor="flow-username" className="text-sm font-medium">
                Username
              </Label>
              <Input
                id="flow-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="padel_ninja"
                className="h-11 font-mono text-base lowercase transition-colors duration-200"
                maxLength={24}
              />
            </div>
          </>
        ) : null}

        {stepId === "name" ? (
          <>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Name on court
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">How teammates see you on draws.</p>
            <div className="mt-4 space-y-2">
              <Label htmlFor="flow-name" className="text-sm font-medium">
                Display name
              </Label>
              <Input
                id="flow-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
                placeholder="Alex"
                className="h-11 text-base transition-colors duration-200"
              />
            </div>
          </>
        ) : null}

        {stepId === "avatar" ? (
          <>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Add a profile photo
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Optional—friends see it in leagues and lists. Skip now and add one anytime in
              settings.
            </p>
            <div className="mt-4">
              <ProfileAvatarField
                variant="onboarding"
                name={name.trim() || "Player"}
                username={username.trim() ? normalizeUsername(username) : null}
                avatarUrl={defaults?.avatar_url?.trim() ?? null}
              />
            </div>
          </>
        ) : null}

        {stepId === "playstyle" ? (
          <>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Your vibe
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">What fits you best?</p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {PLAYSTYLE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setPlaystyle(o.value)}
                  className={cn(
                    "min-h-[80px] rounded-xl border-2 p-3 text-left transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "hover:border-primary/40 active:scale-[0.99] motion-reduce:active:scale-100",
                    playstyle === o.value
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/80 bg-card",
                  )}
                >
                  <span className="font-medium">{o.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{o.hint}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {stepId === "strengths" ? (
          <>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Your weapons
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Tap to toggle—show off what you’ve got.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {STRENGTH_OPTIONS.map((o) => {
                const on = strengths.has(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleInSet(strengths, setStrengths, o.value)}
                    title={o.hint}
                    className={cn(
                      "min-h-10 rounded-full border px-3 py-2 text-sm font-medium transition-all duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "active:scale-[0.98] motion-reduce:active:scale-100",
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
          </>
        ) : null}

        {stepId === "weaknesses" ? (
          <>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Still growing
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Honest picks help balance sides.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {WEAKNESS_OPTIONS.map((o) => {
                const on = weaknesses.has(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleInSet(weaknesses, setWeaknesses, o.value)}
                    title={o.hint}
                    className={cn(
                      "min-h-10 rounded-full border px-3 py-2 text-sm font-medium transition-all duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "active:scale-[0.98] motion-reduce:active:scale-100",
                      on
                        ? "border-amber-600/80 bg-amber-500/15 text-foreground dark:border-amber-500/60"
                        : "border-border/80 bg-muted/40 hover:bg-muted",
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {stepId === "preferred_side" ? (
          <>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Favourite side
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Where you feel most at home.</p>
            <div className="mt-4 grid gap-2.5">
              {PREFERRED_SIDE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setPreferredSide(o.value)}
                  className={cn(
                    "min-h-[68px] rounded-xl border-2 p-3 text-left transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "hover:border-primary/40 active:scale-[0.99] motion-reduce:active:scale-100",
                    preferredSide === o.value
                      ? "border-primary bg-primary/5"
                      : "border-border/80 bg-card",
                  )}
                >
                  <span className="font-medium">{o.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{o.hint}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {stepId === "experience" ? (
          <>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Level check
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">So we match session intensity.</p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {EXPERIENCE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setExperienceLevel(o.value)}
                  className={cn(
                    "min-h-[80px] rounded-xl border-2 p-3 text-left transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "hover:border-primary/40 active:scale-[0.99] motion-reduce:active:scale-100",
                    experienceLevel === o.value
                      ? "border-primary bg-primary/5"
                      : "border-border/80 bg-card",
                  )}
                >
                  <span className="font-medium">{o.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{o.hint}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        </div>

        <div className="flex w-full flex-col items-stretch gap-3 pt-5 sm:flex-row sm:items-center sm:justify-end">
          <div
            key={stepId}
            className={cn(
              "flex w-full justify-end sm:w-auto",
              reducedMotion
                ? ""
                : "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300",
            )}
          >
            <Button
              type="button"
              size="lg"
              className={cn(
                "min-h-11 w-full min-w-0 sm:w-auto sm:min-w-[140px]",
                primaryBtnMotion,
              )}
              disabled={pending}
              onClick={handlePrimary}
            >
              {pending ? "Saving…" : primaryLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
