---
name: Winner wreath PFP ring
overview: Render the `/winner.png` laurel as a visible ring around each circular PFP (not a large plate behind), and give championship #1 rows two separate winner frames—one per player.
todos:
  - id: wreath-z-order-ring
    content: Adjust WinnerAvatarFrame so laurel reads as PFP border (stacking/mask/insets); stroke-only inner ring optional; remove fill-behind look
    status: pending
  - id: pair-two-frames
    content: Replace single variant="pair" wrapper with two WinnerAvatarFrame single (spotlight + table); tune spacing/sizes
    status: pending
isProject: false
---

# Winner icon as PFP border + per-player champ circles

## Goal

1. **Single #1:** The winners laurel (`/winner.png`) should read as the **border / frame** around the profile photo, not a big graphic **behind** the headshot.
2. **Pair #1 (champ):** **Each** of the two players gets **their own** circular winner treatment (two separate rings), not one wide `variant="pair"` frame around both avatars.

## Current behavior (baseline)

- [`components/winner-avatar-frame.tsx`](components/winner-avatar-frame.tsx): `Image` is `z-0` **behind**; avatar sits in an inset slot `z-[1]` with its own `ring` / `rounded-full`.
- `variant="pair"` uses one wide box and one wreath for **both** children ([`LeagueSpotlightPodium`](components/league/league-spotlight-podium.tsx) ~274, [`league-page-tabs`](components/league/league-page-tabs.tsx) pair table ~327).

## 1) Wreath as “border” (single)

**Intent:** Visually the laurel hugs the circular PFP edge (broadcast-style medal frame), not a full-bleed background.

**Implementation directions (pick minimal that works with the existing PNG):**

- **Stacking:** Try `Image` at **`z-[2]`** above the avatar with `object-contain` and tighter insets so petals sit on the **rim**; keep the face fully visible in the center (may require reducing `avatarSlotClass` insets or scaling the image).
- If the asset’s transparent center is large enough, an **overlay** wreath can sit on top of the circle while the face shows through the PNG’s alpha.
- If overlap still looks “behind,” add a subtle **CSS mask** on the image (e.g. radial: show more opacity near the outer ring) only if needed—avoid heavy filters unless required.
- Remove or soften the inner `ring-*` on the avatar slot if it fights the laurel; keep `rounded-full` + `overflow-hidden` on the photo.

**Files:** [`components/winner-avatar-frame.tsx`](components/winner-avatar-frame.tsx) only, unless a follow-up asset swap is needed.

## 2) Champ pair: two circles

- **Spotlight:** In [`components/league/league-spotlight-podium.tsx`](components/league/league-spotlight-podium.tsx) `PairPillar`, replace one `<WinnerAvatarFrame variant="pair" …>` wrapping both avatars with a **flex row** of two `<WinnerAvatarFrame variant="single" frameSize="spotlight">` each wrapping one `UserAvatarDisplay`.
- **Standings table:** In [`components/league/league-page-tabs.tsx`](components/league/league-page-tabs.tsx), same for rank-1 pair row: two single frames instead of `variant="pair"`.
- **Sizing:** After switch, verify row height and spotlight grid—`pair` width was intentional; two singles may need slightly smaller `frameSize` or gap (`gap-0.5` / `gap-1`) so the pair row does not overflow.

## 3) Cleanup

- If `variant="pair"` is unused, remove it from `WinnerAvatarFrame` props and docs comment to avoid confusion; otherwise keep only if still referenced elsewhere.

## 4) Verify

- Single #1 in table + spotlight: wreath clearly frames the circle, not a backdrop.
- Pair #1: two distinct laurel rings, aligned and readable on sm breakpoints.
