# LobSmash

**LobSmash** is a league management and leaderboard application for racket-sport groups. Organisers run seasons with shareable join codes; members record sessions and matches; standings update automatically for **King of Court** and **Americano** formats—one place for results, roles, and stats.

---

## Overview

| | |
| --- | --- |
| **Purpose** | Multi-league hub: rosters, sessions, game history, and format-aware rankings. |
| **Users** | Authenticated players with profiles (`@username`, optional avatar); league owners and admins manage membership and data entry permissions. |
| **Data model** | PostgreSQL on Supabase with Row Level Security (RLS); application code uses the signed-in user’s identity for every data access path. |

---

## Technology

| Area | Choice |
| --- | --- |
| Application | [Next.js](https://nextjs.org) 16 (App Router), [React](https://react.dev) 19 |
| Interface | [Tailwind CSS](https://tailwindcss.com) 4, component patterns aligned with [shadcn/ui](https://ui.shadcn.com) |
| Authentication | [Clerk](https://clerk.com) — sessions, sign-in/up, route protection |
| Database | [Supabase](https://supabase.com) — Postgres, RLS, optional Storage for avatars |

**Identity and security:** Clerk user IDs map to rows in `public.users`. The Supabase client attaches the Clerk-issued JWT so Postgres policies enforce tenant and membership rules. Implementation details live under `lib/supabase/`; contributor notes are in `AGENTS.md`.

---

## Capabilities

- **Identity & profiles** — Clerk-based sign-in; onboarding for display name and username; optional profile images when storage migrations are applied.
- **Leagues** — Create leagues with auto-generated join codes; join by code; owner/admin/member roles; roster linking and administration.
- **Sessions & matches** — Session workflows (including team and input configuration); game entry and removal according to league permissions.
- **Leaderboards** — Aggregated standings (wins, games, points, court placement) with tie-break rules that follow the selected league format.
- **Social** — Friend requests and user discovery; extended search behaviour when friendship and avatar-related migrations are present.

---

## Requirements

- **Node.js** 20 or newer (LTS recommended)
- **Clerk** project with publishable and secret API keys
- **Supabase** project: project URL, anon key, and Clerk configured under **Authentication → Third-party auth** per Supabase’s Clerk integration guide

---

## Local development

1. **Clone**

   ```bash
   git clone https://github.com/trenchsheikh/lobsmash-leaderboard.git
   cd lobsmash-leaderboard
   ```

2. **Install**

   ```bash
   npm install
   ```

3. **Configure environment**

   Copy `.env.local.example` to `.env.local` and set variables from the Clerk and Supabase dashboards. Never commit secrets or `.env.local`.

4. **Apply database migrations**

   Run the SQL migration files **in the order** documented in [`supabase/HOSTED_SETUP.md`](supabase/HOSTED_SETUP.md). You may use the Supabase SQL Editor or the optional Node migration runner when `DATABASE_URL` is available locally.

5. **Start the app**

   ```bash
   npm run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000).

---

## npm scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Optimised production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run db:migrate:clerk` | Apply Clerk / JWT text-id migration (see `package.json` for file path) |
| `npm run db:migrate:last-seen` | Optional audit fields migration |
| `npm run db:migrate:avatar-storage` | Avatar URL column and storage policies |
| `npm run db:migrate:avatar-search-rpc` | Friend-search RPC including avatars (requires prior friendship migration) |
| `npm run db:migrate:file -- <path>` | Run an arbitrary migration file via `scripts/run-migration.cjs` |

---

## Repository layout

| Path | Role |
| --- | --- |
| `app/` | App Router routes: authentication, dashboard, leagues, sessions, friends, profile |
| `components/` | Feature UI, forms, and shared primitives |
| `lib/` | Auth helpers, Supabase clients, leaderboard logic, shared utilities |
| `supabase/migrations/` | Versioned SQL for schema, RLS, and functions |

---

## Additional documentation

| Document | Contents |
| --- | --- |
| [`supabase/HOSTED_SETUP.md`](supabase/HOSTED_SETUP.md) | Migration order, hosted Supabase setup, optional CLI-style runs |
| [`docs/CLERK_DASHBOARD.md`](docs/CLERK_DASHBOARD.md) | Clerk dashboard settings relevant to this app |

---

## License

This repository does not include a `LICENSE` file. Add one if you intend to publish terms for use or contribution.
