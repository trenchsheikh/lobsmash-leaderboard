import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/lib/button-variants";
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
}: {
  leagueId: string;
  sessions: LeagueSessionRow[];
}) {
  return (
    <ul className="flex flex-col gap-2">
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
                buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className:
                    "group h-auto min-h-11 w-full justify-between gap-3 whitespace-normal px-4 py-3 text-left font-normal",
                }),
                "border-border/80 bg-card hover:border-primary/40 hover:bg-muted/40",
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
                <p className="text-muted-foreground mt-1 text-sm">{metaParts.join(" · ")}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-muted-foreground hidden text-xs font-medium sm:inline">
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
  );
}
