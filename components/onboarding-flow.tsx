"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Inter, Manrope } from "next/font/google";
import { toast } from "sonner";
import { completeOnboarding } from "@/app/actions/onboarding";
import { updateProfile } from "@/app/actions/profile";
import { checkUsernameAvailability, type UsernameCheckResult } from "@/app/actions/username";
import { suggestUsernames } from "@/app/actions/username-suggestions";
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
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  Circle,
  Gauge,
  Loader2,
  RefreshCw,
  UserCircle,
  X as XIcon,
} from "lucide-react";
import { ProfileAvatarField } from "@/components/profile-avatar-field";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

const onboardingHeadingFont = Manrope({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const onboardingBodyFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

function TennisBallIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/tennis-ball.svg"
      alt=""
      width={13}
      height={12}
      className={className}
      aria-hidden
    />
  );
}

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
  | "playstyle"
  | "strengths"
  | "weaknesses"
  | "preferred_side"
  | "experience";

const ALL_STEPS: StepId[] = [
  "intro",
  "username",
  "name",
  "playstyle",
  "strengths",
  "weaknesses",
  "preferred_side",
  "experience",
];

const SUGGESTION_COUNT = 3;

const SIDEBAR_STAGES = [
  {
    id: "profile",
    title: "Profile setup",
    subtitle: "Handle, name & photo",
    steps: ["username", "name"] as StepId[],
  },
  {
    id: "play",
    title: "How you play",
    subtitle: "Style & strengths",
    steps: ["playstyle", "strengths"] as StepId[],
  },
  {
    id: "improve",
    title: "Improve my game",
    subtitle: "Areas to focus on",
    steps: ["weaknesses", "preferred_side"] as StepId[],
  },
  {
    id: "location",
    title: "Location",
    subtitle: "Find courts near you",
    steps: ["experience"] as StepId[],
  },
  {
    id: "done",
    title: "You're in",
    subtitle: "Go to your dashboard",
    steps: [] as StepId[],
  },
] as const;

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
  /** After onboarding, submit join request and redirect (e.g. `/join/<league code>`). */
  joinRedirectUrl?: string | null;
};

export function OnboardingFlow({
  defaults,
  variant,
  accountSlot,
  joinRedirectUrl,
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
  const [mobileStagesOpen, setMobileStagesOpen] = useState(false);

  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const suggestionReqId = useRef(0);

  const refreshUsernameSuggestions = useCallback(
    async (exclude: string[] = []) => {
      const reqId = ++suggestionReqId.current;
      setLoadingSuggestions(true);
      try {
        const next = await suggestUsernames(SUGGESTION_COUNT, exclude);
        if (reqId === suggestionReqId.current) {
          setUsernameSuggestions(next);
        }
      } catch {
        if (reqId === suggestionReqId.current) {
          setUsernameSuggestions([]);
        }
      } finally {
        if (reqId === suggestionReqId.current) {
          setLoadingSuggestions(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (stepId !== "username") return;
    if (usernameSuggestions.length > 0 || loadingSuggestions) return;
    void refreshUsernameSuggestions();
  }, [stepId, usernameSuggestions.length, loadingSuggestions, refreshUsernameSuggestions]);

  const [username, setUsername] = useState(() => pickInitialUsername(defaults));
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState(defaults?.name?.trim() ?? "");
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
    setMobileStagesOpen(false);
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

  const displayAs = (() => {
    const d = displayName.trim();
    if (d) return d;
    const f = firstName.trim();
    if (!f) return "";
    const l = lastName.trim();
    return l ? `${f} ${l[0]!.toUpperCase()}.` : f;
  })();

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("username", username.trim().toLowerCase());
    fd.set("name", displayAs);
    fd.set("playstyle", playstyle);
    fd.set("preferred_side", preferredSide);
    fd.set("experience_level", experienceLevel);
    for (const s of strengths) fd.append("strengths", s);
    for (const w of weaknesses) fd.append("weaknesses", w);
    if (variant === "onboarding" && joinRedirectUrl) {
      fd.set("redirect_url", joinRedirectUrl);
    }
    return fd;
  }

  function validateCurrent(): string | null {
    switch (stepId) {
      case "intro":
        return null;
      case "username": {
        const u = normalizeUsername(username);
        const formatErr = validateUsernameFormat(u);
        if (formatErr) return formatErr;
        if (availability.status === "checking") return "Checking username…";
        if (availability.status === "taken") return "That username is already taken.";
        if (availability.status === "error")
          return availability.message ?? "Could not verify that username. Try again.";
        if (availability.status === "available" || availability.status === "yours") return null;
        return "Pick a valid username.";
      }
      case "name":
        return displayAs ? null : "Add a first name or a display name.";
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
        if (res && "redirectTo" in res && typeof res.redirectTo === "string") {
          router.push(res.redirectTo);
        } else {
          router.push("/dashboard");
        }
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
  const currentSidebarStageIndex =
    variant !== "onboarding"
      ? 0
      : Math.max(
          0,
          SIDEBAR_STAGES.findIndex((stage) =>
            stage.steps.includes(stepId),
          ),
        );
  const activeSidebarStage = SIDEBAR_STAGES[currentSidebarStageIndex] ?? SIDEBAR_STAGES[0];
  const activeStageStepIndex = Math.max(0, activeSidebarStage.steps.indexOf(stepId));
  const activeStageStepTotal = activeSidebarStage.steps.length;
  const activeStepLabel = (() => {
    if (!activeSidebarStage.steps.length) return null;
    const mapped: Record<StepId, string> = {
      intro: "Intro",
      username: "Handle",
      name: "Name & photo",
      playstyle: "Style",
      strengths: "Strengths",
      weaknesses: "Areas",
      preferred_side: "Side",
      experience: "Level",
    };
    const activeId = activeSidebarStage.steps[activeStageStepIndex];
    return activeId ? mapped[activeId] : null;
  })();

  const stepMetaLabel =
    activeSidebarStage && activeStageStepTotal > 0 && stepId !== "intro"
      ? `${activeSidebarStage.title} \u2022 Step ${activeStageStepIndex + 1} of ${activeStageStepTotal}`
      : null;

  const usernameNormalized = normalizeUsername(username);
  const usernameFormatError = usernameNormalized
    ? validateUsernameFormat(usernameNormalized)
    : null;
  const usernameFormatValid =
    usernameNormalized.length > 0 && usernameFormatError === null;

  type AvailabilityState =
    | { status: "idle" }
    | { status: "checking"; normalized: string }
    | { status: "invalid"; message: string }
    | UsernameCheckResult;

  const [serverCheck, setServerCheck] = useState<{ for: string; result: UsernameCheckResult } | null>(null);

  useEffect(() => {
    if (!usernameFormatValid) return;
    const target = usernameNormalized;
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(target);
        if (cancelled) return;
        setServerCheck({ for: target, result: res });
      } catch {
        if (cancelled) return;
        setServerCheck({
          for: target,
          result: { status: "error", message: "Could not check username. Try again." },
        });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [usernameFormatValid, usernameNormalized]);

  const availability: AvailabilityState = (() => {
    if (!usernameNormalized) return { status: "idle" };
    if (usernameFormatError) return { status: "invalid", message: usernameFormatError };
    if (serverCheck && serverCheck.for === usernameNormalized) return serverCheck.result;
    return { status: "checking", normalized: usernameNormalized };
  })();

  const usernameOk =
    availability.status === "available" || availability.status === "yours";

  const primaryBtnMotion = cn(
    "relative overflow-hidden rounded-full font-semibold shadow-md",
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
    <div
      className={cn(
        onboardingBodyFont.className,
        "fixed inset-0 z-0 flex w-full min-w-0 flex-col overflow-hidden bg-[#00235B]",
        "lg:static lg:z-auto lg:min-h-0 lg:flex-row lg:overflow-visible",
      )}
    >
      {variant === "onboarding" ? (
        <aside className="relative order-1 flex w-full shrink-0 flex-col overflow-hidden bg-[#00235B] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white sm:px-8 sm:pb-8 sm:pt-[calc(env(safe-area-inset-top)+1.75rem)] lg:order-none lg:w-[42%] lg:max-w-[min(32rem,42vw)] lg:min-h-[100dvh] lg:px-10 lg:pb-[calc(env(safe-area-inset-bottom)+3rem)] lg:pt-[calc(env(safe-area-inset-top)+2.5rem)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-2 motion-safe:duration-500">
          <Image
            src="/tennis-ball.png"
            alt=""
            width={256}
            height={256}
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-16 size-56 select-none opacity-[0.07] blur-[1px] sm:size-64 sm:-right-24 sm:-top-20 max-lg:hidden"
          />
          <Image
            src="/tennis-ball.png"
            alt=""
            width={256}
            height={256}
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -left-14 size-52 -rotate-45 select-none opacity-[0.06] blur-[1px] sm:size-60 sm:-bottom-20 sm:-left-16 max-lg:hidden"
          />
          <div className="relative z-10 flex items-center justify-between gap-3 lg:mb-9">
            <Image
              src="/lobsmash-logo-removebg-preview.png"
              alt="LobSmash"
              width={160}
              height={160}
              className="h-7 w-auto shrink-0 object-contain object-left brightness-0 invert sm:h-10"
            />
            <button
              type="button"
              onClick={() => setMobileStagesOpen((v) => !v)}
              aria-expanded={mobileStagesOpen}
              aria-controls="onboarding-stage-list"
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-white",
                "bg-white/10 transition-colors duration-200 active:bg-white/15",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86E10B]/70 focus-visible:ring-offset-0",
                "touch-manipulation select-none [-webkit-tap-highlight-color:transparent]",
                "lg:hidden",
              )}
            >
              <span className="max-w-[10rem] truncate leading-none">
                {activeSidebarStage?.title ?? "Setup"}
              </span>
              {activeStageStepTotal > 0 ? (
                <span
                  aria-hidden
                  className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide text-white/70"
                >
                  {activeStageStepIndex + 1}/{activeStageStepTotal}
                </span>
              ) : null}
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-white/80 transition-transform duration-200",
                  mobileStagesOpen ? "rotate-180" : "rotate-0",
                )}
                aria-hidden
              />
              <span className="sr-only">
                {mobileStagesOpen ? "Hide setup steps" : "Show setup steps"}
              </span>
            </button>
          </div>
          <p className="relative z-10 mb-6 text-xs text-white/55 max-lg:hidden">
            Complete the following steps to set up your profile
          </p>
          <ol
            id="onboarding-stage-list"
            className={cn(
              "relative z-10 space-y-7",
              mobileStagesOpen
                ? "max-lg:mt-4 max-lg:block"
                : "max-lg:hidden",
            )}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute left-[15px] top-[18px] bottom-[4px] w-[2px] bg-[#2b588f] z-0"
            />
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-[15px] top-[18px] w-[2px] rounded-full bg-[#86E10B] z-0",
                "shadow-[0_0_8px_rgba(134,225,11,0.35)]",
                reducedMotion
                  ? ""
                  : "transition-[height] duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[height]",
              )}
              style={{
                height: `calc((100% - 22px) * ${
                  SIDEBAR_STAGES.length > 1
                    ? currentSidebarStageIndex / (SIDEBAR_STAGES.length - 1)
                    : 0
                })`,
              }}
            />
            {SIDEBAR_STAGES.map((stage, idx) => {
              const active = idx === currentSidebarStageIndex;
              const done = idx < currentSidebarStageIndex;
              return (
                <li key={stage.id} className="relative flex gap-3">
                  <div className="mt-0.5 flex w-8 flex-col items-center">
                    <span
                      className={cn(
                        "relative z-10 grid size-8 place-items-center rounded-full",
                        "before:absolute before:rounded-full before:content-['']",
                        active
                          ? "bg-[#86E10B] before:-inset-[3px] before:border before:border-[#86E10B]/50 before:bg-[#86E10B]/15 before:shadow-[0_0_12px_rgba(134,225,11,0.28)]"
                          : done
                            ? "bg-[#86E10B] before:-inset-[2px] before:border before:border-[#86E10B]/35 before:bg-[#86E10B]/10"
                            : "border border-[#2e5b95] bg-[#00235B] before:hidden",
                      )}
                    >
                      {active || done ? (
                        <TennisBallIcon className="relative z-10 size-[14px]" />
                      ) : null}
                    </span>
                  </div>
                  <div className="pt-0.5">
                    <p className={cn("text-sm font-semibold leading-[1.1]", active ? "text-white" : "text-[#4d6f9f]")}>
                      {stage.title}
                    </p>
                    <p className={cn("mt-1 text-xs leading-[1.25]", active ? "text-[#90A8C8]" : "text-[#3f6294]")}>
                      {active && activeStageStepTotal > 0
                        ? `Step ${activeStageStepIndex + 1} of ${activeStageStepTotal} — ${activeStepLabel ?? stage.subtitle}`
                        : stage.subtitle}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>
      ) : null}

      <section className="relative order-2 flex min-w-0 flex-1 flex-col bg-white motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-400">
        <div className="w-full flex-1 overflow-y-auto px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5 sm:px-5 sm:pt-6 lg:px-6 lg:pb-28">
          <div className="w-full max-w-[1240px]">
            {accountSlot ? (
              <div className="mb-6 border-b border-border/60 pb-4">{accountSlot}</div>
            ) : null}

            <div className="mb-6" role="group" aria-label={variant === "onboarding" ? "Onboarding progress" : "Profile progress"}>
              <div
                className="h-[2px] overflow-hidden rounded-full bg-[#e7ebf1]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                aria-valuetext={`Step ${stepIndex + 1} of ${steps.length}`}
              >
                <div
                  className={cn("h-full rounded-full bg-[#86E10B] ease-out", reducedMotion ? "" : "transition-[width] duration-300")}
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
                  <div className="w-full max-w-[620px] space-y-6">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#89c319]">Getting started</p>
                      <h1
                        className={cn(
                          onboardingHeadingFont.className,
                          "mt-2 text-[28px] font-bold leading-[1.15] tracking-tight text-[#002d62]",
                        )}
                      >
                        Your LobSmash profile
                      </h1>
                      <p className="mt-3 text-[17px] leading-[1.45] text-[#6f7d91]">
                        A short setup so teammates can find you in leagues and lineups.
                      </p>
                      <p className="mt-5 text-[16px] leading-[1.35] text-[#7a8799]">
                        You can edit everything later in settings.
                      </p>
                    </div>
                    <div className="space-y-3.5">
                      {SIDEBAR_STAGES.slice(0, 4).map((stage, idx) => {
                        const active = idx === 0;
                        const copy =
                          stage.id === "profile"
                            ? { title: "Profile", subtitle: "Handle, name, photo" }
                            : { title: stage.title, subtitle: stage.subtitle };
                        return (
                          <div
                            key={stage.id}
                            className={cn(
                              "flex items-center gap-3 rounded-[10px] border px-3.5 py-3",
                              active
                                ? "border-[#c7dd95] bg-[#e9f4cf]"
                                : "border-[#e2e8f0] bg-[#f8fafc]",
                            )}
                          >
                            {active ? (
                              <span
                                className="grid size-6 shrink-0 place-items-center rounded-full bg-[#86E10B] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                                aria-hidden
                              >
                                <Check className="size-[14px] text-[#0F1E3F]" strokeWidth={3} />
                              </span>
                            ) : (
                              <Circle
                                className="size-6 shrink-0 text-[#d2d9e3]"
                                aria-hidden
                                strokeWidth={1.5}
                              />
                            )}
                            <div>
                              <p className="text-[15px] font-semibold leading-[1.1] text-[#24344d]">{copy.title}</p>
                              <p className="mt-1 text-[13px] leading-[1.15] text-[#8491a4]">{copy.subtitle}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {stepId !== "intro" && stepMetaLabel ? (
                  <p className="text-[13px] font-semibold tracking-tight text-[#86E10B]">
                    {stepMetaLabel}
                  </p>
                ) : null}

                {stepId === "username" ? (
                  <div className="w-full max-w-[620px]">
                    <h1
                      className={cn(
                        onboardingHeadingFont.className,
                        "mt-1 text-[28px] font-bold leading-[1.1] tracking-tight text-[#00235B] sm:text-[34px]",
                      )}
                    >
                      Pick a handle
                    </h1>
                    <p className="mt-2 text-[15px] leading-[1.45] text-[#6f7d91]">
                      This is your unique league ID.
                    </p>
                    <div className="mt-6 space-y-2">
                      <Label
                        htmlFor="flow-username"
                        className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#00235B]"
                      >
                        Username
                      </Label>
                      <div className="relative">
                        <Input
                          id="flow-username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          autoComplete="username"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          inputMode="text"
                          enterKeyHint="next"
                          placeholder="padel_ninja"
                          maxLength={24}
                          aria-invalid={availability.status === "taken" || availability.status === "invalid"}
                          className={cn(
                            "h-[52px] rounded-[10px] border-[1.5px] pr-14 text-[16px] lowercase text-[#0F1E3F] placeholder:text-[#aab1bf] transition-colors duration-200 sm:text-[15px]",
                            availability.status === "taken"
                              ? "border-[#e11d48] bg-[#fef2f4] focus-visible:border-[#e11d48] focus-visible:ring-[#e11d48]/20"
                              : usernameOk
                                ? "border-[#86E10B] bg-[#F7FCEB] focus-visible:border-[#86E10B] focus-visible:ring-[#86E10B]/25"
                                : "border-[#E2E8F0] focus-visible:border-[#86E10B] focus-visible:ring-[#86E10B]/20",
                          )}
                        />
                        {availability.status === "checking" && usernameFormatValid ? (
                          <span
                            className="pointer-events-none absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-[#eef1f6]"
                            aria-hidden
                          >
                            <Loader2 className="size-4 animate-spin text-[#7a8598]" />
                          </span>
                        ) : null}
                        {usernameOk ? (
                          <span
                            className="pointer-events-none absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-[#86E10B] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                            aria-hidden
                          >
                            <Check className="size-4 text-white" strokeWidth={3} />
                          </span>
                        ) : null}
                        {availability.status === "taken" ? (
                          <span
                            className="pointer-events-none absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-[#e11d48] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                            aria-hidden
                          >
                            <XIcon className="size-4 text-white" strokeWidth={3} />
                          </span>
                        ) : null}
                      </div>
                      {availability.status === "available" ? (
                        <p className="inline-flex items-center gap-1.5 pt-1 text-[13px] text-[#4a8a0e]">
                          <span className="size-1.5 rounded-full bg-[#86E10B]" aria-hidden />
                          {availability.normalized} is available
                        </p>
                      ) : availability.status === "yours" ? (
                        <p className="inline-flex items-center gap-1.5 pt-1 text-[13px] text-[#4a8a0e]">
                          <span className="size-1.5 rounded-full bg-[#86E10B]" aria-hidden />
                          That&rsquo;s your current handle
                        </p>
                      ) : availability.status === "taken" ? (
                        <p className="inline-flex items-center gap-1.5 pt-1 text-[13px] text-[#c0123a]">
                          <span className="size-1.5 rounded-full bg-[#e11d48]" aria-hidden />
                          {availability.normalized} is already taken
                        </p>
                      ) : availability.status === "checking" ? (
                        <p className="inline-flex items-center gap-1.5 pt-1 text-[13px] text-[#7a8598]">
                          <Loader2 className="size-3 animate-spin" aria-hidden />
                          Checking availability…
                        </p>
                      ) : availability.status === "invalid" ? (
                        <p className="pt-1 text-[13px] text-[#c0123a]">{availability.message}</p>
                      ) : availability.status === "error" ? (
                        <p className="pt-1 text-[13px] text-[#c0123a]">{availability.message}</p>
                      ) : null}
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <span className="text-[13px] text-[#8491a4]">Suggestions:</span>
                      {loadingSuggestions && usernameSuggestions.length === 0
                        ? Array.from({ length: SUGGESTION_COUNT }).map((_, i) => (
                            <span
                              key={`sk-${i}`}
                              aria-hidden
                              className="h-7 w-24 animate-pulse rounded-full bg-[#eef1f6]"
                            />
                          ))
                        : usernameSuggestions.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setUsername(s)}
                              className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-[13px] text-[#4d5b73] transition-colors duration-200 hover:border-[#86E10B] hover:text-[#00235B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86E10B]/40"
                            >
                              {s}
                            </button>
                          ))}
                      <button
                        type="button"
                        onClick={() =>
                          void refreshUsernameSuggestions(usernameSuggestions)
                        }
                        disabled={loadingSuggestions}
                        aria-label="Shuffle suggestions"
                        title="Shuffle suggestions"
                        className={cn(
                          "inline-flex size-7 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#4d5b73]",
                          "transition-colors duration-200 hover:border-[#86E10B] hover:text-[#00235B]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86E10B]/40",
                          "disabled:opacity-60",
                          "touch-manipulation [-webkit-tap-highlight-color:transparent]",
                        )}
                      >
                        <RefreshCw
                          className={cn(
                            "size-3.5",
                            loadingSuggestions && "animate-spin",
                          )}
                          aria-hidden
                        />
                      </button>
                    </div>
                  </div>
                ) : null}

                {stepId === "name" ? (
                  <div className="w-full max-w-[720px]">
                    <h1
                      className={cn(
                        onboardingHeadingFont.className,
                        "mt-1 text-[28px] font-bold leading-[1.1] tracking-tight text-[#00235B] sm:text-[34px]",
                      )}
                    >
                      Name &amp; photo
                    </h1>
                    <p className="mt-2 text-[15px] leading-[1.45] text-[#6f7d91]">
                      How teammates see you.
                    </p>

                    <div className="mt-6">
                      <ProfileAvatarField
                        variant="onboarding-compact"
                        name={displayAs || "Player"}
                        username={username.trim() ? normalizeUsername(username) : null}
                        avatarUrl={defaults?.avatar_url?.trim() ?? null}
                        allowRemove={variant === "profile"}
                      />
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label
                          htmlFor="flow-first-name"
                          className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#00235B]"
                        >
                          First name
                        </Label>
                        <Input
                          id="flow-first-name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          autoComplete="given-name"
                          autoCapitalize="words"
                          enterKeyHint="next"
                          placeholder="Alex"
                          className="h-[52px] rounded-[10px] border-[1.5px] border-[#E2E8F0] text-[16px] text-[#0F1E3F] placeholder:text-[#aab1bf] transition-colors duration-200 focus-visible:border-[#00235B] focus-visible:ring-[#00235B]/15 sm:text-[15px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="flow-last-name"
                          className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#00235B]"
                        >
                          Last name
                        </Label>
                        <Input
                          id="flow-last-name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          autoComplete="family-name"
                          autoCapitalize="words"
                          enterKeyHint="next"
                          placeholder="Smith"
                          className="h-[52px] rounded-[10px] border-[1.5px] border-[#E2E8F0] text-[16px] text-[#0F1E3F] placeholder:text-[#aab1bf] transition-colors duration-200 focus-visible:border-[#00235B] focus-visible:ring-[#00235B]/15 sm:text-[15px]"
                        />
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label
                        htmlFor="flow-display-name"
                        className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#00235B]"
                      >
                        Display name
                      </Label>
                      <Input
                        id="flow-display-name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        autoComplete="nickname"
                        autoCapitalize="words"
                        enterKeyHint="done"
                        placeholder="How it appears for others"
                        className="h-[52px] rounded-[10px] border-[1.5px] border-[#E2E8F0] bg-[#f7f9fc] text-[16px] text-[#0F1E3F] placeholder:text-[#aab1bf] transition-colors duration-200 focus-visible:border-[#00235B] focus-visible:ring-[#00235B]/15 sm:text-[15px]"
                      />
                    </div>

                    {displayAs ? (
                      <div className="mt-4 rounded-[10px] border border-[#e1edc1] bg-[#f2f8dd] px-4 py-3">
                        <p className="text-[12px] text-[#6f7d91]">Appears as</p>
                        <p className="mt-0.5 text-[16px] font-semibold text-[#00235B]">
                          {displayAs}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {stepId === "playstyle" ? (
                  <div className="w-full max-w-[620px]">
                    <h1
                      className={cn(
                        onboardingHeadingFont.className,
                        "mt-1 text-[28px] font-bold leading-[1.1] tracking-tight text-[#00235B] sm:text-[34px]",
                      )}
                    >
                      Your vibe
                    </h1>
                    <p className="mt-2 text-[15px] leading-[1.45] text-[#6f7d91]">What fits you best?</p>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {PLAYSTYLE_OPTIONS.map((o) => {
                        const on = playstyle === o.value;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => setPlaystyle(o.value)}
                            className={cn(
                              "min-h-[80px] rounded-[10px] border-[1.5px] p-4 text-left transition-all duration-200",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86E10B]/40",
                              "active:scale-[0.99] motion-reduce:active:scale-100",
                              on
                                ? "border-[#86E10B] bg-[#F7FCEB]"
                                : "border-[#E2E8F0] bg-white hover:border-[#86E10B]/60",
                            )}
                          >
                            <span className="block text-[15px] font-semibold text-[#00235B]">{o.label}</span>
                            <span className="mt-1 block text-[13px] leading-[1.25] text-[#6f7d91]">{o.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {stepId === "strengths" ? (
                  <div className="w-full max-w-[620px]">
                    <h1
                      className={cn(
                        onboardingHeadingFont.className,
                        "mt-1 text-[28px] font-bold leading-[1.1] tracking-tight text-[#00235B] sm:text-[34px]",
                      )}
                    >
                      Your weapons
                    </h1>
                    <p className="mt-2 text-[15px] leading-[1.45] text-[#6f7d91]">
                      Tap to toggle — show off what you&rsquo;ve got.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2">
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
                              "min-h-10 rounded-full border-[1.5px] px-4 py-2 text-[14px] font-medium transition-all duration-200",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86E10B]/40",
                              "active:scale-[0.98] motion-reduce:active:scale-100",
                              on
                                ? "border-[#86E10B] bg-[#86E10B] text-[#00235B]"
                                : "border-[#E2E8F0] bg-white text-[#4d5b73] hover:border-[#86E10B]/60 hover:text-[#00235B]",
                            )}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {stepId === "weaknesses" ? (
                  <div className="w-full max-w-[620px]">
                    <h1
                      className={cn(
                        onboardingHeadingFont.className,
                        "mt-1 text-[28px] font-bold leading-[1.1] tracking-tight text-[#00235B] sm:text-[34px]",
                      )}
                    >
                      Still growing
                    </h1>
                    <p className="mt-2 text-[15px] leading-[1.45] text-[#6f7d91]">
                      Honest picks help balance sides.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2">
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
                              "min-h-10 rounded-full border-[1.5px] px-4 py-2 text-[14px] font-medium transition-all duration-200",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86E10B]/40",
                              "active:scale-[0.98] motion-reduce:active:scale-100",
                              on
                                ? "border-[#00235B] bg-[#00235B] text-white"
                                : "border-[#E2E8F0] bg-white text-[#4d5b73] hover:border-[#00235B]/60 hover:text-[#00235B]",
                            )}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {stepId === "preferred_side" ? (
                  <div className="w-full max-w-[620px]">
                    <h1
                      className={cn(
                        onboardingHeadingFont.className,
                        "mt-1 text-[28px] font-bold leading-[1.1] tracking-tight text-[#00235B] sm:text-[34px]",
                      )}
                    >
                      Favourite side
                    </h1>
                    <p className="mt-2 text-[15px] leading-[1.45] text-[#6f7d91]">Where you feel most at home.</p>
                    <div className="mt-6 grid gap-3">
                      {PREFERRED_SIDE_OPTIONS.map((o) => {
                        const on = preferredSide === o.value;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => setPreferredSide(o.value)}
                            className={cn(
                              "min-h-[68px] rounded-[10px] border-[1.5px] p-4 text-left transition-all duration-200",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86E10B]/40",
                              "active:scale-[0.99] motion-reduce:active:scale-100",
                              on
                                ? "border-[#86E10B] bg-[#F7FCEB]"
                                : "border-[#E2E8F0] bg-white hover:border-[#86E10B]/60",
                            )}
                          >
                            <span className="block text-[15px] font-semibold text-[#00235B]">{o.label}</span>
                            <span className="mt-1 block text-[13px] leading-[1.25] text-[#6f7d91]">{o.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {stepId === "experience" ? (
                  <div className="w-full max-w-[620px]">
                    <h1
                      className={cn(
                        onboardingHeadingFont.className,
                        "mt-1 text-[28px] font-bold leading-[1.1] tracking-tight text-[#00235B] sm:text-[34px]",
                      )}
                    >
                      Level check
                    </h1>
                    <p className="mt-2 text-[15px] leading-[1.45] text-[#6f7d91]">So we match session intensity.</p>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {EXPERIENCE_OPTIONS.map((o) => {
                        const on = experienceLevel === o.value;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => setExperienceLevel(o.value)}
                            className={cn(
                              "min-h-[80px] rounded-[10px] border-[1.5px] p-4 text-left transition-all duration-200",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86E10B]/40",
                              "active:scale-[0.99] motion-reduce:active:scale-100",
                              on
                                ? "border-[#86E10B] bg-[#F7FCEB]"
                                : "border-[#E2E8F0] bg-white hover:border-[#86E10B]/60",
                            )}
                          >
                            <span className="block text-[15px] font-semibold text-[#00235B]">{o.label}</span>
                            <span className="mt-1 block text-[13px] leading-[1.25] text-[#6f7d91]">{o.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {error ? (
                  <p className="mt-4 text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-[#e2e8f0] bg-white px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-5 lg:px-6">
          <div className="flex w-full max-w-[1240px] items-center justify-between">
            <div>
              {canGoBack ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#7a8598] transition-colors duration-200 hover:text-[#5e6b80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  <span>Back</span>
                </button>
              ) : null}
            </div>
            <Button
              type="button"
              size="lg"
              className={cn(
                "h-[42px] w-full max-w-[210px] rounded-full bg-[#86E10B] px-8 font-semibold text-[#00235B] hover:bg-[#95ea1d] sm:w-[210px]",
                primaryBtnMotion,
              )}
              disabled={pending}
              onClick={handlePrimary}
            >
              <span className="inline-flex items-center gap-1">
                {pending ? "Saving…" : primaryLabel}
                <ArrowRight className="size-4" aria-hidden />
              </span>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
