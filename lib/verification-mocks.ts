import type { BookableSlot } from "@/components/verification/verification-slots-book-grid";

/** Stable fake user ids (not in DB) — only for UI previews. */
export const DEMO_COACH_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
export const DEMO_COACH_B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";

/**
 * Minimal preview copy for the demo coach card (not from DB).
 * Credentials mirror the common UK pathway: LTA Padel Instructor (L2) plus pathway expectations.
 */
export type DemoCoachVerificationProfile = {
  coachUserId: string;
  /** Informal one-liner, e.g. how they coach */
  tagline: string;
  /** Short, chatty bio */
  vibe: string;
  /** Where they tend to run sessions */
  localPatch: string;
  /** Shown with checkmarks — illustrative preview labels only */
  credentials: string[];
};

const DEMO_COACH_VERIFICATION_PROFILES: Record<string, DemoCoachVerificationProfile> = {
  [DEMO_COACH_A]: {
    coachUserId: DEMO_COACH_A,
    tagline: "Bit of a tactics nerd — I like clean structure and honest feedback.",
    vibe: "Ex–league doubles skipper; happiest when we play real points so I can actually see how you think on court. No fluff, just what I saw that day.",
    localPatch: "Mostly north & central London — Kentish Town, Chiswick, that sort of patch.",
    credentials: [
      "LTA Padel Instructor (Level 2)",
      "Safeguarding & DBS in line with LTA coach pathway expectations",
      "Emergency first aid at work (typical before LTA final assessment)",
    ],
  },
  [DEMO_COACH_B]: {
    coachUserId: DEMO_COACH_B,
    tagline: "Calm energy, sharp eyes — good if you want a straight read on your game.",
    vibe: "I’ve played a lot of tournament padel; I’ll keep the session moving and tell you plainly how you showed up. Still friendly, promise.",
    localPatch: "South & west London — Battersea, Stratford, Ealing when the diary allows.",
    credentials: [
      "LTA Padel Instructor (Level 2)",
      "Safeguarding & DBS in line with LTA coach pathway expectations",
      "LTA lesson assessment completed (video submission route — usual on the pathway)",
    ],
  },
};

export function getDemoCoachVerificationProfile(
  coachUserId: string,
): DemoCoachVerificationProfile | undefined {
  return DEMO_COACH_VERIFICATION_PROFILES[coachUserId];
}

export type DemoInboxRow = {
  id: string;
  player_id: string;
  status: "pending";
  created_at: string;
};

/**
 * Preview inbox rows — ids use `demo-` prefix so pages can skip Supabase lookups for them.
 * Player display names are seeded via `seedDemoInboxProfileMaps`.
 */
export const DEMO_INBOX_PLAYER_1 = "demo-player-london-1";
export const DEMO_INBOX_PLAYER_2 = "demo-player-london-2";
export const DEMO_INBOX_USER_1 = "demo-user-london-1";
export const DEMO_INBOX_USER_2 = "demo-user-london-2";

export function verificationMocksEnabled(): boolean {
  if (process.env.VERIFICATION_USE_MOCKS === "false") return false;
  return (
    process.env.VERIFICATION_USE_MOCKS === "true" ||
    (process.env.NODE_ENV === "development" && process.env.VERIFICATION_USE_MOCKS !== "false")
  );
}

/** Preview slot / inbox / player ids (not client-simulated request rows). */
export function isDemoVerificationId(id: string): boolean {
  return id.startsWith("demo-") && !id.startsWith("demo-sim-req-");
}

/** Client-only simulated request row after a demo booking (not in Postgres). */
export function isSimulatedDemoRequestId(id: string): boolean {
  return id.startsWith("demo-sim-req-");
}

function isoUtcDaysFromNow(daysFromNow: number, hourUtc: number, minuteUtc: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  d.setUTCHours(hourUtc, minuteUtc, 0, 0);
  return d.toISOString();
}

/** Two London padel preview sessions (Jamie’s slot uses a featured “Book now” CTA in the UI). */
export function getDemoBookableSlots(): BookableSlot[] {
  return [
    {
      id: "demo-slot-london-1",
      coach_user_id: DEMO_COACH_A,
      venue: "Game4Padel, Talacre Community Centre, Kentish Town NW5",
      starts_at: isoUtcDaysFromNow(3, 10, 0),
      duration_minutes: 90,
      notes: "Indoor courts — bring your own balls if you prefer Wilson.",
      coach: {
        name: "Jamie Holloway",
        username: "jamie_padel_ldn",
        avatar_url: null,
      },
      bookButtonLabel: "Book now",
    },
    {
      id: "demo-slot-london-2",
      coach_user_id: DEMO_COACH_B,
      venue: "Padel Social Club, Battersea Park SW11",
      starts_at: isoUtcDaysFromNow(4, 18, 30),
      duration_minutes: 60,
      notes: "Outdoor terrace courts — arrive 10 min early to check in.",
      coach: {
        name: "Sam Okonkwo",
        username: "sam_padl",
        avatar_url: null,
      },
    },
  ];
}

export function seedDemoCoachLabels(
  coachNames: Map<string, { name: string | null; username: string | null }>,
) {
  coachNames.set(DEMO_COACH_A, { name: "Jamie Holloway", username: "jamie_padel_ldn" });
  coachNames.set(DEMO_COACH_B, { name: "Sam Okonkwo", username: "sam_padl" });
}

export function getDemoInboxRows(): DemoInboxRow[] {
  const older = new Date();
  older.setUTCDate(older.getUTCDate() - 2);
  const recent = new Date();
  recent.setUTCDate(recent.getUTCDate() - 1);
  return [
    {
      id: "demo-inbox-london-1",
      player_id: DEMO_INBOX_PLAYER_1,
      status: "pending",
      created_at: older.toISOString(),
    },
    {
      id: "demo-inbox-london-2",
      player_id: DEMO_INBOX_PLAYER_2,
      status: "pending",
      created_at: recent.toISOString(),
    },
  ];
}

export function seedDemoInboxProfileMaps(
  playersById: Map<string, { name: string; user_id: string | null }>,
  usersById: Map<string, { username: string | null; avatar_url: string | null }>,
) {
  playersById.set(DEMO_INBOX_PLAYER_1, { name: "Morgan Blake", user_id: DEMO_INBOX_USER_1 });
  usersById.set(DEMO_INBOX_USER_1, { username: "morgan_padl", avatar_url: null });
  playersById.set(DEMO_INBOX_PLAYER_2, { name: "Riley Chen", user_id: DEMO_INBOX_USER_2 });
  usersById.set(DEMO_INBOX_USER_2, { username: "riley_ct", avatar_url: null });
}
