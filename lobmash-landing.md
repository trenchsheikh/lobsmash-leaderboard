# LobSmash — Landing page copy (source document)

This file is **marketing and product copy** for building a public **landing page**. It summarizes what LobSmash does today so designers and writers do not need to read the codebase. Technical setup (env vars, migrations) stays in the main [`README.md`](README.md).

---

## One-liner

**LobSmash** is the home for your **padel** league: create or join a league with a simple code, run **sessions** on multiple courts, and let **standings** and a **global skill rating** update automatically—plus **friends** and a profile that show how you play.

---

## The problem we solve

**Organisers** juggle WhatsApp groups, spreadsheets, and ad-hoc rules. Players lose track of **who’s ahead**, how **Americano** differs from **Summit**, and whether results from last night are reflected anywhere official.

**LobSmash** gives one place for:

- Shareable **join codes** and **invite links**
- **Role-based** access (owners and admins control who gets in and who enters results)
- **Format-aware** leaderboards so the ranking rules match how your night actually works
- A **single skill number** across leagues so improvement is visible over time—not locked inside one group chat

---

## Who it’s for

| Audience | What they get |
| --- | --- |
| **Club or league organisers** | Create leagues, approve join requests, share codes/links, oversee rosters and sessions. |
| **Admins** | Help manage the league alongside the owner (permissions depend on role). |
| **Players** | Join leagues, play in sessions, see standings, track skill, connect with friends. |

**Tone:** Padel-first (doubles, courts, partners, walls). The app is built for racket-sport groups; **padel** is the default language in onboarding and profile copy.

---

## Core journey (happy path)

1. **Sign up or sign in** (secure account).
2. **Onboarding** — display name, `@username`, and a player profile (play style, preferred side, experience, strengths, areas to grow).
3. **Dashboard** — create a **new league** or **request to join** an existing one with a code or invite link.
4. **League** — open the league, start a **new session**, enter **teams, courts, and results** using the wizard.
5. When the session is **completed**, **standings** and (where applicable) **skill rating** update.
6. **Friends** — optional: find people, send requests, compare on a **friends leaderboard**.
7. **Profile** — avatar, skill level, history, and account details in one place.

---

## Authentication and account

- Sign-in and sign-up are handled by **Clerk** (email/OAuth depending on how the project is configured).
- Main app routes are **protected**: you must be signed in to use the dashboard, leagues, friends, and profile.
- The home route sends signed-in users to the **dashboard** and others to **login** (there is no separate marketing homepage in the app today—this document is for the one you will build).

---

## Onboarding (first-time profile)

After sign-up, players complete a short profile so they show up correctly in leagues and on friend lists:

- **Display name** and **`@username`** (unique handle used across the app).
- **Play style** — choose from options such as *Net presser*, *Wall grinder*, *Lob tactician*, *Counter striker*, *All-court mixer*, or *Still finding my feet* (each has a short hint).
- **Preferred side** — left (drive), right, or either.
- **Experience level** — from first steps on court through social play, club leagues, and tournament play.
- **Strengths** — pick what you’re known for (e.g. bandeja, víbora, net presence, court speed).
- **Areas to grow** — honest picks (e.g. back-glass panic, transition to net) so teammates know how to support you.

Optional **avatar** upload when storage is configured in the project.

---

## Dashboard

The dashboard is the **control room**:

- **Page title** — “Dashboard” with a short line about running your padel league or club.
- **Create a league** — collapsed by default; expand to set **name**, **format** (see below), and submit. The app generates an **8-character league code** and you can share the **invite link** from the league page after creation.
- **Create a tournament** — **Coming soon** (placeholder in the product; no tournament flow yet).
- **Join a league** — paste an **invite link** or type the **8-character code**. Joining creates a **request**; an **organiser must approve** before you appear in the league.
- **My leagues** — table of leagues you belong to (with role) and **pending** join requests, with links to open the league or the invite preview page.

---

## Leagues and formats

When you create a league, you pick a **format**. That choice drives **how sessions are scored**, **what appears on the leaderboard**, and **how skill updates apply** (summaries below; exact rules live in the product).

| Format | Player-facing idea |
| --- | --- |
| **Summit** | You **move up or down courts** based on results. The app focuses on the **championship (top) court** to line up who’s ahead—wins and participation matter for the league table. |
| **Americano** | You **rotate partners** across games. **Points** from every game add up to see who’s performing best overall. |
| **Round Robin** | **Fair rotations** against different people. **Full scores** from all courts feed the standings. |
| **Mexicano** | **Mixer-style** shuffles for partners and courts. **Points** across the session decide who’s on top. |

**Short blurbs (for cards or tooltips):**

- **Summit:** “You move up or down courts by winning. We track the top court—that’s how we line up who’s ahead.”
- **Americano:** “You swap partners each game. We add up points from every game to see who’s doing best.”
- **Round Robin:** “Everyone gets fair turns against different people. We use full scores from all courts to rank players.”
- **Mexicano:** “Partners and courts shuffle like a fun mixer. We count points from every game across the session.”

### Join codes, links, and approval

- Each league has a **short code** and a shareable **invite URL**.
- Joining is **never silent**: every join is a **request** until an **owner or admin** approves—so random codes don’t add strangers without consent.

### Roles

- **Owner** — creates the league; full control.
- **Admin** — can help manage members and league operations (within the permissions the app grants).
- **Member** — plays and appears in standings; may not manage the league depending on role.

---

## Sessions and results

- **New session** — started from a league (with the right permissions). A **wizard** walks through **date**, **courts**, **roster**, and **results** according to the league format and **input mode** (e.g. Summit may only need **championship-court** results; other formats use **full** scoring across courts).
- **Draft vs completed** — sessions are completed when organisers finish entry; completed sessions feed **stats** and **ratings**.
- **Edit** — where the app allows, sessions can be opened for **edits** (e.g. correcting results).
- **List** — sessions are listed in a **stable order** (including by creation time when multiple fall on the same calendar day).

---

## Standings and stats (league leaderboard)

Standings are **format-aware**:

- **Summit** — ordering emphasises **wins** and **sessions played**, then name for ties.
- **Other formats** — **total points** lead, then **wins**, **games played**, and **top-court** wins where relevant, then name.

**Pair stats (Summit-style leagues):** For championship-focused play, the product can show **pair** performance (wins together) sorted by wins and sessions.

Use this on the landing page as: *“Rankings follow your league format—Summit isn’t scored the same way as Americano.”*

---

## Global skill rating

- Every registered player has **one skill value** across **all leagues** (stored per player, not per league).
- When a session is marked **completed**, the app runs a **reliability-weighted, Elo-style** update using that session’s results (see [`algorithm.md`](algorithm.md) for the full spec).
- **Display** — skill maps to a **level** on a 0–7 scale (in 0.5 steps) for readable UI.
- **Profile** — shows current skill, how many **rated games** count, and a **history** of how skill moved over time.
- **Guests** — players without a full account in a session may appear with a **default skill** for **expected results** but **do not** receive rating updates or rated-game increments.

**One sentence for marketing:** *“Your skill travels with you—every completed session can refine your number, with more stable movement once you’ve played enough games.”*

---

## Friends

- Send and accept **friend requests**; see **incoming** and **outgoing** pending requests.
- **Search** for users (when configured) to send requests.
- **Friends leaderboard** — compare **display levels** (or skill) with **accepted friends** in one table.

---

## Profile

- **Identity** — avatar, **name**, **`@username`** (and optional email display from the sign-in provider).
- **Skill** — current level/skill, rated games, and **history chart**.
- **Play style card** — style, preferred side, experience, strengths, and growth areas from onboarding.
- **Edit profile** — update display fields and avatar where allowed.
- **Account** — sign-in email is shown as managed by the provider.

---

## Public join preview (`/join/[code]`)

- Anyone with a link can open a **preview** for a league **code** before or after signing in—useful to confirm the **league name and format** before requesting to join.

---

## Security and privacy (plain language)

- **Accounts** are managed by the authentication provider; **sessions** are secure.
- **Data** lives in a **PostgreSQL** database with **row-level security** so users only see what they’re allowed to see (e.g. league membership).
- The app connects the signed-in user to the database using **industry-standard** patterns (no shared passwords in the client).

For self-hosting and keys, point technical readers to [`README.md`](README.md) and [`supabase/HOSTED_SETUP.md`](supabase/HOSTED_SETUP.md).

---

## Roadmap and placeholders

- **Tournaments** — **Create a tournament** on the dashboard is a **coming soon** placeholder; there is no tournament bracket or scheduling flow in the product yet.
- Future features should be listed here **only** once shipped, to keep the landing page honest.

---

## For developers (optional landing footer)

If the landing page includes a “Built with” strip:

- **Next.js** (App Router), **React**
- **Tailwind CSS** and UI patterns compatible with **shadcn/ui**
- **Clerk** — authentication
- **Supabase** — Postgres, RLS, optional file storage for avatars

Clone and run instructions: [`README.md`](README.md).

---

## Suggested landing page section order

1. Hero — headline + one-liner + primary CTA (Sign up / Open app).
2. Social proof or club use cases (optional).
3. **League formats** — four cards with the blurbs above.
4. **How it works** — 3–4 steps (join → play session → standings → skill).
5. **Skill rating** — short explanation + link to trust.
6. **Friends & profile** — community and identity.
7. **Security** — short plain-language block.
8. **Roadmap** — tournaments coming soon (if still accurate).
9. Footer — developers strip + docs links.

---

## Changelog for this document

Keep this file updated when you ship major features so the marketing site stays accurate.
