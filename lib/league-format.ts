/** Matches sessions.input_mode / leagues.results_mode values. */
export type SessionInputMode = "full" | "champ_court_only";

export type LeagueFormat = "summit" | "americano" | "round_robin" | "mexicano";

const ALLOWED: readonly LeagueFormat[] = [
  "summit",
  "americano",
  "round_robin",
  "mexicano",
] as const;

export function isLeagueFormat(s: string): s is LeagueFormat {
  return (ALLOWED as readonly string[]).includes(s);
}

export function sessionInputModeForFormat(format: LeagueFormat): SessionInputMode {
  return format === "summit" ? "champ_court_only" : "full";
}

export function formatDisplayName(format: string): string {
  switch (format) {
    case "summit":
      return "Summit";
    case "americano":
      return "Americano";
    case "round_robin":
      return "Round Robin";
    case "mexicano":
      return "Mexicano";
    default:
      return format;
  }
}

/** Short helper line for create-league format select (plain language). */
export function formatShortDescription(format: LeagueFormat): string {
  switch (format) {
    case "summit":
      return "You move up or down courts by winning. We only track the top court here — that’s how we line up who’s ahead.";
    case "americano":
      return "You swap partners each game. We add up points from every game to see who’s doing best.";
    case "round_robin":
      return "Everyone gets fair turns against different people. We use full scores from all courts to rank players.";
    case "mexicano":
      return "Partners and courts shuffle like a fun mixer. We count points from every game across the session.";
    default:
      return "";
  }
}
