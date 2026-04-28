import { RATING_ATTRIBUTE_UI } from "@/lib/verification-attributes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  scores: Record<string, number>;
  notes: Record<string, string> | null;
  coachDisplayName: string | null;
  venue: string | null;
  verifiedAtIso: string;
};

export function ProfileCoachVerifiedAttributes({
  scores,
  notes,
  coachDisplayName,
  venue,
  verifiedAtIso,
}: Props) {
  const when = new Date(verifiedAtIso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/50 bg-muted/15 pb-4">
        <CardTitle className="font-heading text-lg tracking-tight">Coach-verified game profile</CardTitle>
        <CardDescription className="max-w-2xl">
          Ratings from a verified coach session (1–8). Comments are their words on how you showed up
          on court — aligned with how many clubs break down padel performance.
        </CardDescription>
        <p className="text-xs text-muted-foreground">
          {coachDisplayName ? (
            <>
              <span className="font-medium text-foreground">{coachDisplayName}</span>
              {venue ? (
                <>
                  {" "}
                  · {venue}
                </>
              ) : null}
              {" · "}
              {when}
            </>
          ) : (
            when
          )}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-5">
        {RATING_ATTRIBUTE_UI.map((meta) => {
          const raw = scores[meta.value];
          const n =
            typeof raw === "number" && Number.isFinite(raw)
              ? Math.min(8, Math.max(1, Math.round(raw)))
              : null;
          const note = notes?.[meta.value]?.trim() ?? "";
          const Icon = meta.Icon;
          if (n === null) return null;
          const pct = ((n - 1) / 7) * 100;
          return (
            <div
              key={meta.value}
              className="flex gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 sm:gap-4 sm:p-4"
            >
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-foreground shadow-sm ring-1 ring-border/80"
                aria-hidden
              >
                <Icon className="size-[1.15rem] opacity-90" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium text-foreground">{meta.label}</h3>
                  <span className="tabular-nums text-sm font-semibold text-muted-foreground">{n}/8</span>
                </div>
                <div
                  className={cn(
                    "h-2 max-w-md overflow-hidden rounded-full bg-muted",
                    "ring-1 ring-border/60",
                  )}
                  aria-hidden
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {note ? (
                  <blockquote className="border-l-2 border-primary/35 pl-3 text-sm leading-relaxed text-muted-foreground">
                    {note}
                  </blockquote>
                ) : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
