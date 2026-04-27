/** Playing-profile copy from new onboarding design. */

export const EXPERIENCE_OPTIONS = [
  { value: "lt_1y", label: "Less than 1 year", hint: "Total beginner" },
  { value: "y1_3", label: "1–3 years", hint: "Building your game" },
  { value: "y3_5", label: "3–5 years", hint: "Well established" },
  { value: "gt_5y", label: "5+ years", hint: "Seasoned player" },
] as const;

export const PREFERRED_SIDE_OPTIONS = [
  { value: "left", label: "Left", hint: "Drive & smash" },
  { value: "right", label: "Right", hint: "Control & volley" },
  { value: "both", label: "Both", hint: "Flexible" },
] as const;

export const PROFILE_ATTRIBUTE_OPTIONS = [
  { value: "serve_return", label: "Serve & Return" },
  { value: "net_game", label: "Net Game" },
  { value: "power", label: "Power" },
  { value: "consistency", label: "Consistency" },
  { value: "movement", label: "Movement" },
  { value: "tactical_iq", label: "Tactical IQ" },
] as const;

export const IMPROVEMENT_OPTIONS = [
  { value: "serve_return", label: "Serve & return", hint: "First strike accuracy & placement" },
  { value: "net_game", label: "Net game", hint: "Volleys, smashes & net positioning" },
  { value: "consistency", label: "Consistency", hint: "Fewer unforced errors per match" },
  { value: "movement", label: "Movement", hint: "Court coverage & recovery speed" },
  { value: "attacking_play", label: "Attacking play", hint: "Winners, lobs & bandeja control" },
  { value: "tactical_awareness", label: "Tactical awareness", hint: "Reading opponents & game patterns" },
  { value: "mental_strength", label: "Mental strength", hint: "Pressure situations & match nerves" },
  { value: "fitness_stamina", label: "Fitness & stamina", hint: "Endurance across longer matches" },
] as const;

export const TRAVEL_DISTANCE_OPTIONS = [
  { value: "5", label: "5 km" },
  { value: "10", label: "10 km" },
  { value: "25", label: "25 km" },
  { value: "any", label: "Anywhere" },
] as const;

export const USUAL_PLAY_TIME_OPTIONS = [
  { value: "weekday_mornings", label: "Weekday mornings", hint: "Mon–Fri, 6am–11pm" },
  { value: "weekday_evenings", label: "Weekday evenings", hint: "Mon–Fri, 5pm–10pm" },
  { value: "weekends", label: "Weekends", hint: "Sat & Sun, all day" },
  { value: "flexible", label: "Flexible", hint: "Anytime works" },
] as const;

export const PLAYSTYLE_OPTIONS = [
  {
    value: "aggressive_baseliner",
    label: "Aggressive baseliner",
    hint: "You dictate play from the back with powerful groundstrokes, putting opponents under pressure with pace and depth.",
  },
  {
    value: "net_rusher",
    label: "Net rusher",
    hint: "You move forward at every opportunity, finishing points at the net with volleys and overhead smashes.",
  },
  {
    value: "defensive_counter",
    label: "Defensive counter",
    hint: "You excel at retrieving difficult balls and redirecting play, letting opponents make mistakes while you reset.",
  },
  {
    value: "power_hitter",
    label: "Power hitter",
    hint: "Your game is built on raw power - big smashes, hard drives and winners that opponents struggle to handle.",
  },
  {
    value: "consistent_patient",
    label: "Consistent & patient",
    hint: "You rarely make unforced errors, happy to grind long rallies and trust your opponent to crack first.",
  },
  {
    value: "all_court",
    label: "All-court",
    hint: "You adapt your game to any situation - comfortable at the net, baseline or anywhere in between.",
  },
] as const;

/** Kept for compatibility in profile edit surfaces; now mirrors play styles. */
export const STRENGTH_OPTIONS = PLAYSTYLE_OPTIONS;
/** Kept for compatibility in profile edit surfaces; now mirrors play styles. */
export const WEAKNESS_OPTIONS = PLAYSTYLE_OPTIONS;

/** Legacy DB values from pre-padel copy → display label (for hydrating old profiles). */
export const LEGACY_PLAYSTYLE_LABELS: Record<string, string> = {
  aggressive: "Aggressive net play (legacy)",
  defensive: "Defensive / consistent (legacy)",
  all_court: "All-court (legacy)",
  serve_volley: "Serve & volley (legacy)",
};

export const LEGACY_STRENGTH_LABELS: Record<string, string> = {
  Serve: "Serve (legacy)",
  Forehand: "Forehand (legacy)",
  Backhand: "Backhand (legacy)",
  Volley: "Volley (legacy)",
  Movement: "Movement (legacy)",
  Tactical: "Tactical (legacy)",
  "Mental game": "Mental game (legacy)",
};

export const LEGACY_WEAKNESS_LABELS: Record<string, string> = {
  "Second serve": "Second serve (legacy)",
  Backhand: "Backhand (legacy)",
  "Net game": "Net game (legacy)",
  Movement: "Movement (legacy)",
  Consistency: "Consistency (legacy)",
  Returns: "Returns (legacy)",
};

export const LEGACY_SIDE_LABELS: Record<string, string> = {
  left: "Left (deuce) — legacy",
  right: "Right (ad) — legacy",
  both: "Both sides",
  either: "Either side — legacy",
};

export const LEGACY_EXPERIENCE_LABELS: Record<string, string> = {
  beginner: "Beginner (legacy)",
  intermediate: "Intermediate (legacy)",
  advanced: "Advanced (legacy)",
  competitive: "Competitive (legacy)",
};

export function labelForProfileAttribute(value: string): string {
  const opt = PROFILE_ATTRIBUTE_OPTIONS.find((o) => o.value === value);
  return opt?.label ?? value;
}

export function labelForPlaystyle(value: string | null | undefined): string {
  if (!value) return "";
  const opt = PLAYSTYLE_OPTIONS.find((o) => o.value === value);
  if (opt) return opt.label;
  return LEGACY_PLAYSTYLE_LABELS[value] ?? value;
}

export function labelForStrength(value: string): string {
  const opt = STRENGTH_OPTIONS.find((o) => o.value === value);
  if (opt) return opt.label;
  return LEGACY_STRENGTH_LABELS[value] ?? value;
}

export function labelForWeakness(value: string): string {
  const opt = WEAKNESS_OPTIONS.find((o) => o.value === value);
  if (opt) return opt.label;
  return LEGACY_WEAKNESS_LABELS[value] ?? value;
}

export function labelForSide(value: string | null | undefined): string {
  if (!value) return "";
  const opt = PREFERRED_SIDE_OPTIONS.find((o) => o.value === value);
  if (opt) return opt.label;
  return LEGACY_SIDE_LABELS[value] ?? value;
}

export function labelForExperience(value: string | null | undefined): string {
  if (!value) return "";
  const opt = EXPERIENCE_OPTIONS.find((o) => o.value === value);
  if (opt) return opt.label;
  return LEGACY_EXPERIENCE_LABELS[value] ?? value;
}
