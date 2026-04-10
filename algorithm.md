# LobSmash skill rating algorithm

This document describes the **global per-player skill model** used for rating updates when a session is marked **completed**, and how **estimated win** / **estimated share** percentages are shown in the UI.

Constants are shared between:

- PostgreSQL: `supabase/migrations/20260330100000_player_skill_ratings.sql`
- TypeScript: `lib/rating.ts`

---

## Goals

- One **skill number per registered player** (linked to `public.players`), shared across all leagues.
- **Reliability-style updates**: newer or low-history players move **faster**; established players move **slower** (smaller K).
- **Tournament-shaped data**: many games can exist inside one session; updates use a **single skill snapshot** for the whole session so all games that night are judged against the same baseline.
- **Guests** (`players.user_id` is null): contribute **default skill** to expectations but **do not** receive rating updates or `rated_games` increments.

---

## Internal scale

| Constant        | Value | Meaning                                      |
|-----------------|-------|----------------------------------------------|
| `DEFAULT_SKILL` | 1500  | Starting / missing-row skill (Elo-like)     |
| `ELO_SCALE`     | 400   | Denominator in the logistic win model       |
| `K_BASE`        | 32    | Base step size before reliability dampening   |
| `ALPHA`         | 0.05  | Reliability: `K = K_BASE / (1 + ALPHA * rated_games)` |
| `CHAMP_TEMPERATURE` | 200 | Softmax temperature for championship mode |
| `MARGIN_BETA`   | 0.15  | Optional blowout scaling (full mode only)   |
| `MARGIN_CAP`    | 8     | Score diff cap for margin factor            |

**Display level (0–7, linear from internal skill, rounded to 2 decimals for display)**:

- `DISPLAY_SKILL_MIN` = 800 → level 0  
- `DISPLAY_SKILL_MAX` = 2200 → level 7  

See `skillToDisplayLevel()` and `formatDisplayLevel()` in `lib/rating.ts` (UI omits the second decimal when it is 0, e.g. `3.5` not `3.50`).

---

## When ratings run

A trigger on `public.sessions` calls `apply_skill_rating_for_session(session_id)` when `status` becomes **`completed`**.

Idempotency: `sessions.skill_rating_applied_at` is set after processing so the same session is never applied twice.

---

## Mode A — Full sessions (`input_mode = 'full'`)

Data: rows in `public.games` (two teams of two, scores, winner).

### Team strength

For each side, **average** the two players’ skills (guests use `DEFAULT_SKILL` if they have no row).

\[
S_A = \frac{s_{A1} + s_{A2}}{2}, \quad S_B = \frac{s_{B1} + s_{B2}}{2}
\]

### Expected win probability (Side A)

Logistic / Elo form:

\[
E_A = \frac{1}{1 + 10^{(S_B - S_A) / \text{ELO\_SCALE}}}
\]

### Outcome and surprise

\(O_A = 1\) if `winner = 'team_a'`, else \(0\).

\[
\text{surprise}_A = O_A - E_A
\]

Side B’s surprise is \(-\text{surprise}_A\).

### Margin factor (optional)

Let \(\Delta s = | \text{team\_a\_score} - \text{team\_b\_score} |\).

\[
m = 1 + \text{MARGIN\_BETA} \cdot \min\left(1,\ \max\left(0,\ \frac{\Delta s}{\text{MARGIN\_CAP}}\right)\right)
\]

Each player’s delta is multiplied by \(m\) so decisive scores nudge updates slightly more than tight matches.

### Per-player K (reliability)

At **session snapshot** time, read `rated_games` from `player_ratings` (0 if no row).

\[
K_i = \frac{\text{K\_BASE}}{1 + \alpha \cdot \text{rated\_games}_i}
\]

### Delta per game

For each **registered** player on team A:

\[
\Delta s_i = K_i \cdot \text{surprise}_A \cdot m
\]

For each registered player on team B:

\[
\Delta s_i = K_i \cdot (-\text{surprise}_A) \cdot m
\]

### Batch across the session

For every game in the session (ordered by court, id), accumulate \(\Delta s_i\) and count **how many games** each player played. Then:

- `skill += sum(Δ)`
- `rated_games += games_played_in_this_session`

---

## Mode B — Championship court only (`input_mode = 'champ_court_only'`)

Data: `public.session_teams` (pairs) and `public.session_court1_pair_wins` (**wins per pair on court 1 only**). There is **no** stored head-to-head matrix (we do not know which pair beat which on each win).

So we **do not** apply pairwise Elo between specific matchups. Instead we use a **within-session share model**.

### Observed shares

For each team (pair) \(i\), wins \(w_i\). Total \(W = \sum_i w_i\).

\[
o_i = \frac{w_i}{W}
\]

### Expected shares (softmax over pair strengths)

Pair strength is the **average** of the two players’ skills (same as full mode team average).

\[
p_i = \frac{e^{S_i / T}}{\sum_j e^{S_j / T}}, \quad T = \text{CHAMP\_TEMPERATURE}
\]

### Update

For each registered player on pair \(i\):

\[
\Delta s = K_i \cdot (o_i - p_i)
\]

Same \(K_i\) formula as full mode, using snapshot `rated_games`.

**Rated games increment (champ):** each updated player gets **`rated_games += 1`** for the session (one “event” bump, not one per court-1 win), so long multi-win nights do not dominate reliability.

---

## UI: side odds vs court 1 split (padel levels)

| UI label                    | Mode   | Meaning |
|-----------------------------|--------|---------|
| **Side odds (levels)**      | Full   | \(E_A\) for Side A vs Side B for that game row (team averages from global padel levels). Side B is \(1 - E_A\). |
| **Court 1 split (levels)**  | Champ | Softmax \(p_i\): model **fraction of all court-1 wins** we’d expect this pair to take vs the other pairs in the session. **Not** a single-match win probability. |

**Important:** On **completed** sessions, the app recomputes these from **today’s** global skills unless we later store per-game snapshots.

---

## Friends leaderboard sort order

Primary: **higher `skill` first**.  
Tie-breakers: total wins, total points, total games, then name (see `lib/friends-data.ts`).

---

## Future work

- Backfill `apply_skill_rating_for_session` for historical completed sessions with `skill_rating_applied_at IS NULL`.
- Per-league or per-format ratings.
- Store **pre-match** skill snapshot on each game row for exact historical “estimated win at time played”.
- Uncertainty bands (e.g. Glicko-style) for provisional players.
