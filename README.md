# Lobs Smash Leaderboard

A web app for running **padel-style leagues**: create leagues with join codes, record sessions and games, and track standings with format-specific leaderboards (**King of Court** and **Americano**). Built for groups who want a simple, shared source of truth for results and stats.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | [Next.js](https://nextjs.org) 16 (App Router) |
| UI | React 19, [Tailwind CSS](https://tailwindcss.com) 4, [shadcn/ui](https://ui.shadcn.com)-style components |
| Auth | [Clerk](https://clerk.com) (sessions, protected routes) |
| Data | [Supabase](https://supabase.com) (PostgreSQL + Row Level Security) |

Clerk identities are mapped to app users in Postgres; the Supabase client uses the Clerk session JWT for RLS—see `lib/supabase/` and project rules in `AGENTS.md`.

## Features

- **Accounts & profiles** — Sign in with Clerk; onboard with display name and `@username`; optional avatar storage.
- **Leagues** — Create or join with a code; owner/admin roles; roster and member management.
- **Sessions & games** — Session workflow with team/input modes; game entry and deletion tied to league permissions.
- **Leaderboards** — Standings and win/points stats with ordering that depends on league format.
- **Friends** — Friend requests and discovery (with optional avatar-aware search when migrations are applied).

## Prerequisites

- **Node.js** 20+ (recommended)
- **Clerk** application (publishable + secret keys)
- **Supabase** project (URL + anon key; Clerk connected under Authentication → Third-party)

## Getting started

1. **Clone the repository**

   ```bash
   git clone https://github.com/trenchsheikh/lobsmash-leaderboard.git
   cd lobsmash-leaderboard
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment variables**

   Copy `.env.local.example` to `.env.local` and fill in values from the Clerk and Supabase dashboards. Do not commit `.env.local`.

4. **Database**

   Apply SQL migrations to your Supabase database **in order**. Full file list and options (SQL Editor vs. local `DATABASE_URL` runner) are documented in [`supabase/HOSTED_SETUP.md`](supabase/HOSTED_SETUP.md).

5. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Run the production server |
| `npm run lint` | ESLint |
| `npm run db:migrate:clerk` | Run Clerk id / JWT migration (see `package.json` for path) |
| `npm run db:migrate:last-seen` | Optional last-seen migration |
| `npm run db:migrate:avatar-storage` | Avatar URL + storage bucket migration |
| `npm run db:migrate:avatar-search-rpc` | Friend search RPC with avatars (depends on friendships migration) |
| `npm run db:migrate:file -- <path>` | Run a single migration file via `scripts/run-migration.cjs` |

## Project layout (high level)

- `app/` — Routes: auth, dashboard, leagues, sessions, friends, profile.
- `components/` — Forms, layout, and UI primitives.
- `lib/` — Auth helpers, Supabase clients, leaderboard logic, shared types.
- `supabase/migrations/` — Ordered SQL for schema and RLS.

## Documentation

- [`supabase/HOSTED_SETUP.md`](supabase/HOSTED_SETUP.md) — Migration order and hosted Supabase setup.
- [`docs/CLERK_DASHBOARD.md`](docs/CLERK_DASHBOARD.md) — Clerk dashboard notes (session, third-party Supabase).

## License

No license file is included in this repository; add one if you need explicit terms for contributors or users.
