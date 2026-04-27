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
  IMPROVEMENT_OPTIONS,
  PROFILE_ATTRIBUTE_OPTIONS,
  PLAYSTYLE_OPTIONS,
  PREFERRED_SIDE_OPTIONS,
  TRAVEL_DISTANCE_OPTIONS,
  USUAL_PLAY_TIME_OPTIONS,
} from "@/lib/onboarding-options";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Circle,
  Loader2,
  Moon,
  RefreshCw,
  Sun,
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
  preferred_side?: string | null;
  experience_level?: string | null;
  strengths?: string[] | null;
  profile_attributes?: Record<string, number> | null;
  improvement_areas?: string[] | null;
  city_or_postcode?: string | null;
  travel_distance_km?: number | null;
  usual_play_times?: string[] | null;
};

type StepId =
  | "intro"
  | "username"
  | "name"
  | "playing_profile"
  | "improve_game"
  | "location";

const ALL_STEPS: StepId[] = [
  "intro",
  "username",
  "name",
  "playing_profile",
  "improve_game",
  "location",
];

const SUGGESTION_COUNT = 3;
const ATTRIBUTE_ICON_BY_VALUE: Record<string, string> = {
  serve_return: "/serve-return.svg",
  net_game: "/net-game.svg",
  power: "/power.svg",
  consistency: "/consistencty.svg",
  movement: "/movement.svg",
  tactical_iq: "/tactical-iq.svg",
};
const ATTRIBUTE_COLOR_BY_VALUE: Record<
  string,
  { bg: string; fg: string }
> = {
  serve_return: { bg: "#E7F1FF", fg: "#2B68C9" },
  net_game: { bg: "#E9F7EA", fg: "#2E8F48" },
  power: { bg: "#F6EFD8", fg: "#A17921" },
  consistency: { bg: "#EEF8DE", fg: "#6EA42A" },
  movement: { bg: "#FDE7E7", fg: "#C74B4B" },
  tactical_iq: { bg: "#F1E9FF", fg: "#6E47B8" },
};
const IMPROVEMENT_ICON_BY_VALUE: Record<string, string> = {
  serve_return: "/serve-return.svg",
  net_game: "/net-game.svg",
  consistency: "/consistencty.svg",
  movement: "/movement.svg",
  attacking_play: "/power.svg",
  tactical_awareness: "/tactical-iq.svg",
  mental_strength: "/file.svg",
  fitness_stamina: "/window.svg",
};
const IMPROVEMENT_COLOR_BY_VALUE: Record<string, { bg: string; fg: string }> = {
  serve_return: { bg: "#E7F1FF", fg: "#2B68C9" },
  net_game: { bg: "#E9F7EA", fg: "#2E8F48" },
  consistency: { bg: "#EEF8DE", fg: "#6EA42A" },
  movement: { bg: "#FDE7E7", fg: "#C74B4B" },
  attacking_play: { bg: "#EAF9F0", fg: "#2D9A61" },
  tactical_awareness: { bg: "#F1E9FF", fg: "#6E47B8" },
  mental_strength: { bg: "#FBEAF0", fg: "#B65A7E" },
  fitness_stamina: { bg: "#E9F8F2", fg: "#2A8B6F" },
};

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
    subtitle: "Step 2 — Playing profile",
    steps: ["playing_profile"] as StepId[],
  },
  {
    id: "improve",
    title: "Improve my game",
    subtitle: "Step 3 — Areas to focus on",
    steps: ["improve_game"] as StepId[],
  },
  {
    id: "location",
    title: "Location",
    subtitle: "Step 4 — Find courts",
    steps: ["location"] as StepId[],
  },
  {
    id: "done",
    title: "You're in",
    subtitle: "Go to your dashboard",
    steps: [] as StepId[],
  },
] as const;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
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
  const stepScrollRef = useRef<HTMLDivElement>(null);

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
  const [preferredSide, setPreferredSide] = useState(defaults?.preferred_side ?? "");
  const [experienceLevel, setExperienceLevel] = useState(defaults?.experience_level ?? "");
  const [playstyles, setPlaystyles] = useState<Set<string>>(() => {
    const allowed = new Set<string>(PLAYSTYLE_OPTIONS.map((o) => o.value));
    return new Set((defaults?.strengths ?? []).filter((v) => allowed.has(v)));
  });
  const [attributeRatings, setAttributeRatings] = useState<Record<string, number>>(() => {
    const base: Record<string, number> = {};
    for (const attr of PROFILE_ATTRIBUTE_OPTIONS) {
      const maybe = Number(defaults?.profile_attributes?.[attr.value] ?? 1);
      base[attr.value] = Number.isFinite(maybe) ? Math.max(1, Math.min(8, Math.round(maybe))) : 1;
    }
    return base;
  });
  const [improvementAreas, setImprovementAreas] = useState<Set<string>>(() => {
    const allowed = new Set<string>(IMPROVEMENT_OPTIONS.map((o) => o.value));
    return new Set((defaults?.improvement_areas ?? []).filter((v) => allowed.has(v)));
  });
  const [cityOrPostcode, setCityOrPostcode] = useState(
    defaults?.city_or_postcode?.trim() ?? "",
  );
  const [travelDistanceKm, setTravelDistanceKm] = useState<string>(() => {
    const n = defaults?.travel_distance_km;
    if (typeof n === "number" && Number.isFinite(n)) return String(Math.max(1, Math.round(n)));
    return "10";
  });
  const [usualPlayTimes, setUsualPlayTimes] = useState<Set<string>>(() => {
    const allowed = new Set<string>(USUAL_PLAY_TIME_OPTIONS.map((o) => o.value));
    return new Set((defaults?.usual_play_times ?? []).filter((v) => allowed.has(v)));
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
    const scroller = stepScrollRef.current;
    if (scroller) scroller.scrollTo({ top: 0, behavior: "auto" });
    stepStackRef.current?.focus({ preventScroll: true });
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
  function toggleImprovementArea(value: string) {
    setImprovementAreas((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
        return next;
      }
      if (next.size >= 4) return prev;
      next.add(value);
      return next;
    });
  }
  function toggleUsualPlayTime(value: string) {
    setUsualPlayTimes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
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
    fd.set("playstyle", Array.from(playstyles)[0] ?? "");
    fd.set("preferred_side", preferredSide);
    fd.set("experience_level", experienceLevel);
    for (const style of playstyles) fd.append("strengths", style);
    for (const attr of PROFILE_ATTRIBUTE_OPTIONS) {
      fd.set(`rating_${attr.value}`, String(attributeRatings[attr.value] ?? 1));
    }
    for (const area of improvementAreas) fd.append("improvement_areas", area);
    fd.set("city_or_postcode", cityOrPostcode.trim());
    fd.set("travel_distance_km", travelDistanceKm);
    for (const t of usualPlayTimes) fd.append("usual_play_times", t);
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
      case "playing_profile":
        if (!experienceLevel) return "Tell us your experience level.";
        if (!preferredSide) return "Choose your preferred side.";
        if (playstyles.size === 0) return "Pick at least one play style.";
        return null;
      case "improve_game":
        return null;
      case "location":
        if (!cityOrPostcode.trim()) return "Add your city or postcode.";
        if (usualPlayTimes.size === 0) return "Pick at least one usual play time.";
        return null;
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
          ? "Finish setup"
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
      playing_profile: "Playing profile",
      improve_game: "Improve my game",
      location: "Location",
    };
    const activeId = activeSidebarStage.steps[activeStageStepIndex];
    return activeId ? mapped[activeId] : null;
  })();

  const stepMetaLabel =
    activeSidebarStage && activeStageStepTotal > 0 && stepId !== "intro"
      ? stepId === "improve_game"
        ? "Improve my game • Step 1 of 1"
        : stepId === "location"
          ? "Location • Step 1 of 1"
        : `${activeSidebarStage.title} \u2022 Step ${activeStageStepIndex + 1} of ${activeStageStepTotal}`
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
        "fixed inset-0 z-0 flex w-full min-w-0 flex-col overflow-hidden bg-transparent",
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

      <section className="relative order-2 flex min-w-0 min-h-0 flex-1 flex-col bg-white motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-400">
        <div
          ref={stepScrollRef}
          className="w-full min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3 sm:px-5 sm:pb-8 sm:pt-4 lg:px-6 lg:pb-28"
        >
            <div className="w-full max-w-none">
            {accountSlot ? (
              <div className="mb-6 border-b border-border/60 pb-4">{accountSlot}</div>
            ) : null}

            <div
              className="sticky top-0 z-20 -mx-1 mb-5 bg-white/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/80"
              role="group"
              aria-label={variant === "onboarding" ? "Onboarding progress" : "Profile progress"}
            >
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
                          "mt-1 text-[28px] font-semibold leading-[1.1] tracking-tight text-[#00235B] sm:text-[34px]",
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
                          "mt-1 text-[28px] font-semibold leading-[1.1] tracking-tight text-[#00235B] sm:text-[34px]",
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

                {stepId === "playing_profile" ? (
                  <div className="w-full max-w-none space-y-6 pb-8">
                    <div>
                      <h1
                        className={cn(
                          onboardingHeadingFont.className,
                          "mt-1 text-[28px] font-semibold leading-[1.1] tracking-tight text-[#00235B] sm:text-[34px]",
                        )}
                      >
                        Your playing profile
                      </h1>
                      <p className="mt-2 text-[15px] leading-[1.45] text-[#6f7d91]">
                        This helps us build your player profile and power your AI match analysis.
                      </p>
                    </div>

                    <div>
                      <p
                        className={cn(
                          onboardingHeadingFont.className,
                          "text-[11px] font-semibold uppercase tracking-[0.08em] text-[#00235B]",
                        )}
                      >
                        How long have you been playing padel?
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {EXPERIENCE_OPTIONS.map((o) => {
                          const on = experienceLevel === o.value;
                          return (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => setExperienceLevel(o.value)}
                              className={cn(
                                "min-h-[78px] rounded-[12px] border-[1.5px] p-4 text-left transition-all duration-200",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86E10B]/40",
                                on
                                  ? "border-[#86E10B] bg-[#F3FADF]"
                                  : "border-[#d8dee9] bg-white hover:border-[#86E10B]/60",
                              )}
                            >
                              <span className="block text-[20px] font-semibold text-[#00235B]">{o.label}</span>
                              <span
                                className={cn(
                                  onboardingBodyFont.className,
                                  "mt-1 block text-[13px] text-[#6f7d91]",
                                )}
                              >
                                {o.hint}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p
                        className={cn(
                          onboardingHeadingFont.className,
                          "text-[11px] font-semibold uppercase tracking-[0.08em] text-[#00235B]",
                        )}
                      >
                        Preferred side
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-3 lg:max-w-[620px]">
                        {PREFERRED_SIDE_OPTIONS.map((o) => {
                          const on = preferredSide === o.value;
                          return (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => setPreferredSide(o.value)}
                              className={cn(
                                "min-h-[78px] rounded-[12px] border-[1.5px] p-4 text-left transition-all duration-200",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86E10B]/40",
                                on
                                  ? "border-[#86E10B] bg-[#F3FADF]"
                                  : "border-[#d8dee9] bg-white hover:border-[#86E10B]/60",
                              )}
                            >
                              <span className="block text-[20px] font-semibold text-[#00235B]">{o.label}</span>
                              <span
                                className={cn(
                                  onboardingBodyFont.className,
                                  "mt-1 block text-[13px] text-[#6f7d91]",
                                )}
                              >
                                {o.hint}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#00235B]">
                        Rate your attributes
                        <span className="ml-2 normal-case tracking-normal text-[#6f7d91]">
                          1 = weak · 8 = strong
                        </span>
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:max-w-[860px]">
                        {PROFILE_ATTRIBUTE_OPTIONS.map((attr) => (
                          <div
                            key={attr.value}
                            className="rounded-[12px] border border-[#dfe5ef] bg-[#f3f5fa] p-3"
                          >
                            <p className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-[#00235B]">
                              <span
                                className="grid size-6 place-items-center rounded-full"
                                style={{
                                  backgroundColor:
                                    ATTRIBUTE_COLOR_BY_VALUE[attr.value]?.bg ?? "#E9EFF7",
                                }}
                              >
                                <span
                                  aria-hidden
                                  className="block size-3.5"
                                  style={{
                                    backgroundColor:
                                      ATTRIBUTE_COLOR_BY_VALUE[attr.value]?.fg ?? "#4D5B73",
                                    WebkitMaskImage: `url("${ATTRIBUTE_ICON_BY_VALUE[attr.value] ?? "/window.svg"}")`,
                                    maskImage: `url("${ATTRIBUTE_ICON_BY_VALUE[attr.value] ?? "/window.svg"}")`,
                                    WebkitMaskRepeat: "no-repeat",
                                    maskRepeat: "no-repeat",
                                    WebkitMaskPosition: "center",
                                    maskPosition: "center",
                                    WebkitMaskSize: "contain",
                                    maskSize: "contain",
                                  }}
                                />
                              </span>
                              {attr.label}
                            </p>
                            <div className="grid grid-cols-8 gap-1">
                              {Array.from({ length: 8 }, (_, i) => i + 1).map((score) => {
                                const on = (attributeRatings[attr.value] ?? 1) >= score;
                                return (
                                  <button
                                    key={`${attr.value}-${score}`}
                                    type="button"
                                    aria-label={`${attr.label} rating ${score}`}
                                    onClick={() =>
                                      setAttributeRatings((prev) => ({
                                        ...prev,
                                        [attr.value]: score,
                                      }))
                                    }
                                    className={cn(
                                      "h-7 rounded-md border text-[11px] font-semibold",
                                      on
                                        ? "border-[#79cd0a] bg-[#86E10B] text-[#16314f]"
                                        : "border-[#d6dde8] bg-white text-[#8d98aa]",
                                    )}
                                  >
                                    {score}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#00235B]">
                        Play style <span className="normal-case tracking-normal text-[#6f7d91]">(select all that apply)</span>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {PLAYSTYLE_OPTIONS.map((o) => {
                          const on = playstyles.has(o.value);
                          return (
                            <div key={o.value} className="group relative">
                              <button
                                type="button"
                                aria-pressed={on}
                                onClick={() => toggleInSet(playstyles, setPlaystyles, o.value)}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all duration-150",
                                  on
                                    ? "border-[#00235B] bg-[#e8f0ff] text-[#00235B]"
                                    : "border-[#d8dee9] bg-white text-[#4d5b73] hover:border-[#00235B]/50",
                                )}
                              >
                                {o.label}
                                <span
                                  aria-hidden
                                  className={cn(
                                    "grid size-4 shrink-0 place-items-center rounded-full border text-[10px] font-semibold",
                                    on
                                      ? "border-[#7f96bf] bg-[#d7e6ff] text-[#39507c]"
                                      : "border-[#d8dee9] bg-[#f6f8fb] text-[#8893a6]",
                                  )}
                                >
                                  i
                                </span>
                              </button>

                              <div
                                className={cn(
                                  "pointer-events-none absolute bottom-[calc(100%+8px)] left-0 z-40 w-[280px] rounded-xl border border-[#0b3d8d] bg-[#0B4FAE] p-3 text-white shadow-xl",
                                  "translate-y-1 opacity-0 transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100",
                                )}
                                role="tooltip"
                              >
                                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#A9D236]">
                                  {o.label}
                                </p>
                                <p className="mt-1 text-[12px] leading-[1.35] text-white/95">
                                  {o.hint}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                {stepId === "improve_game" ? (
                  <div className="w-full max-w-none space-y-5 pb-8">
                    <div>
                      <p className="text-[13px] font-semibold tracking-tight text-[#86E10B]">
                        Improve my game • Step 3
                      </p>
                      <h1
                        className={cn(
                          onboardingHeadingFont.className,
                          "mt-1 text-[28px] font-semibold leading-[1.1] tracking-tight text-[#00235B] sm:text-[34px]",
                        )}
                      >
                        Areas for improvement
                      </h1>
                      <p className="mt-2 text-[15px] leading-[1.45] text-[#6f7d91]">
                        Our AI will track these in your matches and give you targeted insights.
                        <span className="ml-1 text-[#8b97a9]">(Optional — select up to 4)</span>
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:max-w-[980px]">
                      {IMPROVEMENT_OPTIONS.map((option) => {
                        const on = improvementAreas.has(option.value);
                        const limitReached = !on && improvementAreas.size >= 4;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleImprovementArea(option.value)}
                            disabled={limitReached}
                            className={cn(
                              "flex items-center gap-3 rounded-[12px] border p-3 text-left transition-all duration-150",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86E10B]/40",
                              on
                                ? "border-[#86E10B] bg-[#F3FADF]"
                                : "border-[#d9dfe8] bg-[#f8fafd] hover:border-[#b8c4d8]",
                              limitReached && "cursor-not-allowed opacity-60",
                            )}
                          >
                            <span
                              className="grid size-8 shrink-0 place-items-center rounded-full"
                              style={{
                                backgroundColor:
                                  IMPROVEMENT_COLOR_BY_VALUE[option.value]?.bg ?? "#E9EFF7",
                              }}
                            >
                              <span
                                aria-hidden
                                className="block size-4"
                                style={{
                                  backgroundColor:
                                    IMPROVEMENT_COLOR_BY_VALUE[option.value]?.fg ?? "#4D5B73",
                                  WebkitMaskImage: `url("${IMPROVEMENT_ICON_BY_VALUE[option.value] ?? "/window.svg"}")`,
                                  maskImage: `url("${IMPROVEMENT_ICON_BY_VALUE[option.value] ?? "/window.svg"}")`,
                                  WebkitMaskRepeat: "no-repeat",
                                  maskRepeat: "no-repeat",
                                  WebkitMaskPosition: "center",
                                  maskPosition: "center",
                                  WebkitMaskSize: "contain",
                                  maskSize: "contain",
                                }}
                              />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[18px] font-semibold text-[#1b355f]">
                                {option.label}
                              </span>
                              <span className="mt-0.5 block text-[13px] text-[#71819a]">
                                {option.hint}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-[12px] text-[#8b97a9]">
                      {improvementAreas.size} of 4 selected — LobSmash AI will highlight these in your
                      post-match reports.
                    </p>
                  </div>
                ) : null}

                {stepId === "location" ? (
                  <div className="w-full max-w-none space-y-5 pb-8">
                    <div>
                      <p className="text-[13px] font-semibold tracking-tight text-[#86E10B]">
                        Location • Step 4
                      </p>
                      <h1
                        className={cn(
                          onboardingHeadingFont.className,
                          "mt-1 text-[28px] font-semibold leading-[1.1] tracking-tight text-[#00235B] sm:text-[34px]",
                        )}
                      >
                        Where do you play?
                      </h1>
                      <p className="mt-2 text-[15px] leading-[1.45] text-[#6f7d91]">
                        We&apos;ll show you courts, open matches and leagues near you.
                      </p>
                    </div>

                    <div className="max-w-[980px] space-y-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="flow-city-postcode"
                          className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#00235B]"
                        >
                          City or postcode
                        </Label>
                        <Input
                          id="flow-city-postcode"
                          value={cityOrPostcode}
                          onChange={(e) => setCityOrPostcode(e.target.value)}
                          placeholder="London, United Kingdom"
                          autoComplete="address-level2"
                          className="h-[52px] rounded-[10px] border-[1.5px] border-[#E2E8F0] text-[16px] text-[#0F1E3F] placeholder:text-[#aab1bf] transition-colors duration-200 focus-visible:border-[#00235B] focus-visible:ring-[#00235B]/15 sm:text-[15px]"
                        />
                      </div>

                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#00235B]">
                          How far will you travel?
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {TRAVEL_DISTANCE_OPTIONS.map((o) => {
                            const on = travelDistanceKm === o.value;
                            return (
                              <button
                                key={o.value}
                                type="button"
                                onClick={() => setTravelDistanceKm(o.value)}
                                className={cn(
                                  "rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors",
                                  on
                                    ? "border-[#00235B] bg-[#00235B] text-white"
                                    : "border-[#d8dee9] bg-white text-[#66758f] hover:border-[#00235B]/40",
                                )}
                              >
                                {o.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#00235B]">
                          When do you usually play?
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:max-w-[860px]">
                          {USUAL_PLAY_TIME_OPTIONS.map((option) => {
                            const on = usualPlayTimes.has(option.value);
                            const Icon =
                              option.value === "weekday_mornings"
                                ? Sun
                                : option.value === "weekday_evenings"
                                  ? Moon
                                  : CalendarDays;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                aria-pressed={on}
                                onClick={() => toggleUsualPlayTime(option.value)}
                                className={cn(
                                  "flex items-center gap-3 rounded-[12px] border p-3 text-left transition-all duration-150",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86E10B]/40",
                                  on
                                    ? "border-[#86E10B] bg-[#F3FADF]"
                                    : "border-[#d9dfe8] bg-[#f8fafd] hover:border-[#b8c4d8]",
                                )}
                              >
                                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#EAF0FA] text-[#5D6F8E]">
                                  <Icon className="size-4" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-[18px] font-semibold text-[#1b355f]">
                                    {option.label}
                                  </span>
                                  <span className="mt-0.5 block text-[13px] text-[#71819a]">
                                    {option.hint}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
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
        <div className="sticky bottom-0 z-20 mt-auto bg-transparent px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:border-t sm:border-[#e2e8f0] sm:bg-white sm:px-5 sm:pb-4 lg:px-6 lg:pb-6">
          <div className="flex w-full max-w-none items-center justify-between">
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
