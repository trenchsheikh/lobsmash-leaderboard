import Image from "next/image";
import { ProfileEditSheet, type ProfileEditDefaults } from "@/components/profile-edit-sheet";
import { ProfileRankFormStrip, type FormResult } from "@/components/profile-rank-form-strip";
import { ProfileRankInfoDialog } from "@/components/profile-rank-info-dialog";
import { ProfileVerificationSeal } from "@/components/profile-verification-seal";
import { UserAvatarDisplay } from "@/components/user-avatar-display";
import { rankFromSkill } from "@/lib/player-rank";
import { formatDisplayLevel } from "@/lib/rating";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  username: string | null;
  avatarUrl: string | null;
  verified: boolean;
  verifiedAtIso: string | null;
  coachDisplayName: string | null;
  coachVenue: string | null;
  skill: number;
  ratedGames: number;
  /** Rating delta vs the configured baseline (e.g. 7-day or all-time start). */
  ratingDelta: number;
  formResults: FormResult[];
  editDefaults: ProfileEditDefaults;
};

export function ProfileRankHero({
  name,
  username,
  avatarUrl,
  verified,
  verifiedAtIso,
  coachDisplayName,
  coachVenue,
  skill,
  ratedGames,
  ratingDelta,
  formResults,
  editDefaults,
}: Props) {
  const rank = rankFromSkill(skill, ratedGames);
  const isUnranked = ratedGames <= 0;
  const showProgress = !isUnranked && rank.nextTierLabel !== null;
  // Delta arrives in display-level units (0-7 scale). Round to 2 decimals.
  const deltaAbs = Math.round(Math.abs(ratingDelta) * 100) / 100;
  const deltaSign = deltaAbs >= 0.01 ? (ratingDelta > 0 ? "+" : "−") : "";
  const deltaToneClass =
    ratingDelta > 0 ? "text-lime-300" : "text-red-400";

  const levelLabel = isUnranked ? "—" : formatDisplayLevel(rank.skill);

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[1.5rem] bg-[var(--brand-navy)] p-4 text-white shadow-lg",
        "sm:rounded-2xl sm:p-6",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 90% -20%, rgba(153,230,0,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 0% 110%, rgba(153,230,0,0.10), transparent 60%)",
        }}
      />

      <div className="relative flex items-start gap-3 sm:gap-5">
        <UserAvatarDisplay
          name={name}
          username={username}
          avatarUrl={avatarUrl}
          size="lg"
          className="size-14 shrink-0 ring-2 ring-primary/40 sm:size-20"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="truncate font-heading text-[1.35rem] font-semibold leading-tight tracking-tight sm:text-3xl">
              {name || "Your profile"}
            </h2>
            <ProfileVerificationSeal
              viewerIsSubject
              verified={verified}
              verifiedAtIso={verifiedAtIso}
              coachDisplayName={coachDisplayName}
              venue={coachVenue}
              size="md"
            />
          </div>
          {username ? (
            <p className="mt-0.5 truncate text-xs font-medium tracking-tight text-white/75 sm:text-sm">
              <span className="text-white/45">@</span>
              {username}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center self-start">
          <ProfileEditSheet
            key={username ?? name}
            defaults={editDefaults}
            triggerClassName="border-white/40 bg-white/15 text-white hover:bg-white/25 hover:text-white"
          />
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap items-center gap-x-3 gap-y-3 sm:mt-6 sm:flex-nowrap sm:gap-x-6">
        <div className="flex min-w-0 items-center gap-3">
          {rank.tier.imageSrc ? (
            <div
              className={cn(
                "relative flex size-16 shrink-0 items-center justify-center rounded-2xl p-1.5 sm:size-[4.5rem]",
                "bg-gradient-to-br from-white/12 to-white/[0.04]",
                "ring-1 ring-white/20",
                "shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)] backdrop-blur-sm",
              )}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-[color-mix(in_srgb,var(--brand-lime)_25%,transparent)]"
              />
              <Image
                src={rank.tier.imageSrc}
                alt={rank.tier.label}
                width={160}
                height={160}
                priority
                className="relative size-full select-none object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
              />
            </div>
          ) : (
            <span
              aria-hidden
              className={cn(
                "flex size-16 items-center justify-center rounded-2xl font-heading text-base font-black uppercase tracking-wider shadow-inner ring-1 ring-white/15 sm:size-[4.5rem]",
                rank.tier.accentClass,
                rank.tier.textClass,
              )}
              title={rank.display}
            >
              ?
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/60">
              Tier
            </p>
            <div className="flex items-center gap-1">
              <p
                className={cn(
                  "bg-clip-text font-heading text-lg font-extrabold leading-tight tracking-tight text-transparent drop-shadow-[0_1px_0_rgba(0,0,0,0.45)] sm:text-xl",
                  rank.tier.shinyClass,
                )}
              >
                {rank.display}
              </p>
              <ProfileRankInfoDialog currentTierId={rank.tier.id} />
            </div>
          </div>
        </div>

        <div className="ml-auto flex flex-col items-end gap-1 sm:ml-0 sm:flex-1 sm:items-center">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/60">
            Rating
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-3xl font-semibold tabular-nums sm:text-4xl">
              {levelLabel}
            </span>
            {deltaSign ? (
              <span className={cn("text-sm font-semibold tabular-nums", deltaToneClass)}>
                {deltaSign}
                {deltaAbs.toFixed(2)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="basis-full sm:basis-auto sm:min-w-[140px]">
          <ProfileRankFormStrip
            results={formResults.slice(0, 5)}
            paddedLength={5}
            size="md"
          />
        </div>
      </div>

      {showProgress ? (
        <div className="relative mt-4 sm:mt-5">
          <div className="flex items-center justify-between text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/70">
            <span>Promotion to {rank.nextTierLabel}</span>
            <span className="font-mono normal-case tracking-normal text-white/60">
              {rank.ratingToNextTier} pts to go
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                rank.tier.progressClass,
              )}
              style={{ width: `${Math.round(rank.progressPct * 100)}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between font-mono text-[0.65rem] text-white/50 tabular-nums">
            <span>{rank.tier.label}</span>
            <span>{Math.round(rank.progressPct * 100)}%</span>
            <span>{rank.nextTierLabel}</span>
          </div>
        </div>
      ) : isUnranked ? (
        <p className="relative mt-4 text-xs text-white/70">
          Play your first competitive match to enter the ladder.
        </p>
      ) : (
        <p className="relative mt-4 text-xs text-white/70">
          You&apos;re at the top tier. Keep your rating climbing to stay in Top 250.
        </p>
      )}
    </section>
  );
}
