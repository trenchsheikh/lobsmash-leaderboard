import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type LeagueSessionRow = {
  id: string;
  date: string;
  status: string;
  num_courts: number | null;
  created_at?: string | null;
  session_teams?: { count: number }[] | null;
};

function formatSessionDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function teamCountFromRow(row: LeagueSessionRow): number {
  const n = row.session_teams?.[0]?.count;
  return typeof n === "number" ? n : 0;
}

function playerCount(row: LeagueSessionRow): number {
  return teamCountFromRow(row) * 2;
}

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "outline" {
  if (status === "completed") return "secondary";
  if (status === "draft") return "outline";
  return "default";
}

function statusLabel(status: string): string {
  if (status === "completed") return "Completed";
  if (status === "draft") return "Draft";
  return status;
}

export function LeagueSessionsList({
  leagueId,
  sessions,
  sectionLabel = "Recent sessions",
}: {
  leagueId: string;
  sessions: LeagueSessionRow[];
  /** Shown above the feed (main “Sessions” title stays on the parent card). */
  sectionLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {sectionLabel ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {sectionLabel}
        </p>
      ) : null}
      <div
        className="overflow-hidden rounded-2xl border border-border/50 bg-card/70 shadow-sm backdrop-blur-sm dark:bg-card/55"
        role="feed"
        aria-label={sectionLabel || "Sessions"}
      >
        <ul className="divide-y divide-border/40">
          {sessions.map((s, idx) => {
            const players = playerCount(s);
            const courts =
              typeof s.num_courts === "number" && s.num_courts >= 1 ? s.num_courts : null;
            const metaParts: string[] = [];
            if (players > 0) {
              metaParts.push(`${players} player${players === 1 ? "" : "s"}`);
            } else {
              metaParts.push("— players");
            }
            if (courts != null) {
              metaParts.push(`${courts} court${courts === 1 ? "" : "s"}`);
            } else {
              metaParts.push("— courts");
            }

            const sessionLabel = `Session ${idx + 1}`;
            const dateLabel = formatSessionDate(s.date);

            return (
              <li key={s.id}>
                <Link
                  href={`/leagues/${leagueId}/sessions/${s.id}`}
                  prefetch={false}
                  className={cn(
                    "group flex w-full min-h-[4.25rem] items-start justify-between gap-3 px-4 py-3.5 text-left transition-colors",
                    "hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                  aria-label={`${sessionLabel}, ${dateLabel}, ${statusLabel(s.status)}. View session details.`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold text-foreground">{sessionLabel}</span>
                      <span className="text-muted-foreground" aria-hidden>
                        ·
                      </span>
                      <span className="font-medium text-foreground">{dateLabel}</span>
                      <Badge variant={statusBadgeVariant(s.status)} className="text-xs capitalize">
                        {statusLabel(s.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{metaParts.join(" · ")}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                    <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                      View
                    </span>
                    <ChevronRight
                      className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
