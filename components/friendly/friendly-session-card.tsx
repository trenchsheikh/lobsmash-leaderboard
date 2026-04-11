import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { Plus } from "lucide-react";

export type FriendlySlotDisplay = {
  slotIndex: number;
  userId: string | null;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  displayLevel: string | null;
};

type Props = {
  title: string | null;
  startsAt: string | null;
  capacity: number;
  status: string;
  ratingBandLabel: string | null;
  teamA: FriendlySlotDisplay[];
  teamB: FriendlySlotDisplay[];
  selectedSlots: [number | null, number | null];
  swapMode: boolean;
  onSlotClick: (slotIndex: number) => void;
};

function formatSessionWhen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const datePart = d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timePart = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} | ${timePart}`;
}

export function FriendlySessionCard({
  title,
  startsAt,
  capacity,
  status,
  ratingBandLabel,
  teamA,
  teamB,
  selectedSlots,
  swapMode,
  onSlotClick,
}: Props) {
  const when = formatSessionWhen(startsAt);
  const open = status === "open";

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="border-b border-border/60 px-4 py-4 sm:px-6 sm:py-5">
        {when ? (
          <p className="font-heading text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {when}
          </p>
        ) : (
          <p className="font-heading text-base font-semibold text-muted-foreground sm:text-lg">
            Date & time TBC
          </p>
        )}
        {title?.trim() ? (
          <p className="mt-1 text-sm text-muted-foreground">{title.trim()}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-foreground/90">
            <span className="text-base" aria-hidden>
              🎾
            </span>
            <span className="font-medium">Friendly</span>
          </span>
          {ratingBandLabel ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="text-muted-foreground/80" aria-hidden>
                ▂▃▅
              </span>
              <span>{ratingBandLabel}</span>
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Users className="size-3.5" aria-hidden />
            {capacity} players
          </span>
          {!open ? (
            <Badge variant="secondary" className="text-xs">
              Closed
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border/70">
        <TeamColumn
          label="Team A"
          slots={teamA}
          selectedSlots={selectedSlots}
          swapMode={swapMode}
          onSlotClick={onSlotClick}
        />
        <TeamColumn
          label="Team B"
          slots={teamB}
          selectedSlots={selectedSlots}
          swapMode={swapMode}
          onSlotClick={onSlotClick}
        />
      </div>
    </div>
  );
}

function TeamColumn({
  label,
  slots,
  selectedSlots,
  swapMode,
  onSlotClick,
}: {
  label: string;
  slots: FriendlySlotDisplay[];
  selectedSlots: [number | null, number | null];
  swapMode: boolean;
  onSlotClick: (slotIndex: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4 px-3 py-5 sm:px-4 sm:py-6">
      <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-col gap-6">
        {slots.map((slot) => (
          <button
            key={slot.slotIndex}
            type="button"
            disabled={!swapMode || !slot.userId}
            onClick={() => onSlotClick(slot.slotIndex)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl transition-colors",
              swapMode && slot.userId && "cursor-pointer hover:bg-muted/40",
              swapMode && !slot.userId && "cursor-not-allowed opacity-60",
              selectedSlots[0] === slot.slotIndex || selectedSlots[1] === slot.slotIndex
                ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                : "",
            )}
          >
            {slot.userId ? (
              <>
                <UserAvatarDisplay
                  name={slot.name}
                  username={slot.username}
                  avatarUrl={slot.avatarUrl}
                  size="lg"
                />
                <span className="max-w-full truncate text-center text-sm font-medium text-foreground/90">
                  {slot.name?.trim() || (slot.username ? `@${slot.username}` : "Player")}
                </span>
                {slot.displayLevel ? (
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold text-foreground",
                      "bg-[color-mix(in_srgb,var(--brand-lime)_85%,transparent)]",
                    )}
                  >
                    {slot.displayLevel}
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <span
                  className={cn(
                    "flex size-14 items-center justify-center rounded-full border-2 border-dashed border-primary/50 bg-primary/5 text-primary",
                    "sm:size-16",
                  )}
                  aria-hidden
                >
                  <Plus className="size-7 stroke-[2.5]" />
                </span>
                <span className="text-sm font-medium text-primary">Available</span>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
