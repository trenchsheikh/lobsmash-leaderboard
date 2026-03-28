/** Padel-focused copy. Values are stable snake_case for DB; labels are user-facing. */

export const PLAYSTYLE_OPTIONS = [
  {
    value: "net_presser",
    label: "Net presser",
    hint: "You love closing space, finishing points, and owning the bandeja zone.",
  },
  {
    value: "wall_grinder",
    label: "Wall grinder",
    hint: "Patience off the glass, reset lobs, and wait for the right ball to attack.",
  },
  {
    value: "lob_tactician",
    label: "Lob tactician",
    hint: "Height, depth, and court position—you move opponents like chess pieces.",
  },
  {
    value: "counter_striker",
    label: "Counter striker",
    hint: "Absorb pace and turn defense into sudden winners with timing.",
  },
  {
    value: "all_court_mixer",
    label: "All-court mixer",
    hint: "Comfortable everywhere—net, walls, and transitions in one rally.",
  },
  {
    value: "padel_rookie",
    label: "Still finding my feet",
    hint: "Learning walls, positioning, and when to leave the ball—no shame.",
  },
] as const;

export const STRENGTH_OPTIONS = [
  { value: "bandeja", label: "Bandeja", hint: "Controlled aggression from mid-court." },
  { value: "vibora", label: "Víbora", hint: "Side-spin attacks that stay low off the glass." },
  { value: "smash_finish", label: "Smash / finishing", hint: "Putting high balls away with authority." },
  { value: "defensive_glass", label: "Defensive glass", hint: "Calm exits from the back glass under pressure." },
  { value: "lob_quality", label: "Lob quality", hint: "Lobs that buy time and break rhythm." },
  { value: "net_presence", label: "Net presence", hint: "Hands fast at the net, poaches, and blocks." },
  { value: "court_speed", label: "Court speed", hint: "Recovery steps and closing to the ball." },
  { value: "serve_rhythm", label: "Serve + first ball", hint: "Starting points with intent." },
  { value: "tactical_patience", label: "Tactical patience", hint: "Choosing the right moment to attack." },
  { value: "back_wall_reading", label: "Reading off the back wall", hint: "Letting balls travel and staying balanced." },
] as const;

export const WEAKNESS_OPTIONS = [
  { value: "back_glass_panic", label: "Back-glass panic", hint: "Tight when the ball sits deep on the glass." },
  { value: "bandeja_consistency", label: "Bandeja consistency", hint: "Height and depth still a work in progress." },
  { value: "smash_defense", label: "Defending smashes", hint: "High lobs and positioning vs overhead pressure." },
  { value: "corner_traffic", label: "Corner traffic", hint: "Getting boxed in on the side glass." },
  { value: "lob_defense", label: "Defending lobs", hint: "Tracking moonballs and staying organized." },
  { value: "net_duels", label: "Net duels", hint: "Quick exchanges and reflex volleys." },
  { value: "transition_net", label: "Moving forward", hint: "Timing the approach from baseline to net." },
  { value: "serve_return", label: "Return of serve", hint: "Neutralizing tricky serves under pressure." },
  { value: "side_wall_reads", label: "Side-wall reads", hint: "Balls that kiss the side glass." },
  { value: "consistency_rallies", label: "Rally consistency", hint: "Unforced errors in longer points." },
] as const;

export const PREFERRED_SIDE_OPTIONS = [
  {
    value: "left",
    label: "Left / drive side",
    hint: "I like the forehand lane, bandeja setup, and owning the left wall.",
  },
  {
    value: "right",
    label: "Right / backhand wall",
    hint: "Comfortable on the right—defense, víboras, and glass exits.",
  },
  {
    value: "either",
    label: "Either side",
    hint: "Happy to adapt—pair me where the team needs balance.",
  },
] as const;

export const EXPERIENCE_OPTIONS = [
  {
    value: "first_steps",
    label: "First steps on court",
    hint: "New to padel—learning rules, walls, and basic positioning.",
  },
  {
    value: "club_social",
    label: "Club & social play",
    hint: "Regular games with friends or open play—building confidence.",
  },
  {
    value: "league_club",
    label: "League & club ladder",
    hint: "Structured matches, local leagues, or club rankings.",
  },
  {
    value: "tournament_hunter",
    label: "Tournaments & events",
    hint: "You chase draws, seeding, and weekend competition.",
  },
] as const;

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
  either: "Either side — legacy",
};

export const LEGACY_EXPERIENCE_LABELS: Record<string, string> = {
  beginner: "Beginner (legacy)",
  intermediate: "Intermediate (legacy)",
  advanced: "Advanced (legacy)",
  competitive: "Competitive (legacy)",
};

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
