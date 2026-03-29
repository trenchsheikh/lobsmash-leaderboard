<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Auth and data

- **Clerk** handles sign-in, session, and route protection (`clerkMiddleware`, `ClerkProvider`).
- **Supabase** is Postgres + RLS only. The app passes the **Clerk session JWT** into `@supabase/supabase-js` via `accessToken` (`lib/supabase/server.ts`, `lib/supabase/clerk-token.ts`). Do not use `@supabase/ssr` cookie auth for identity here.
- **Hosted projects:** apply SQL migrations in order; see `supabase/HOSTED_SETUP.md`. Clerk user ids are text (`user_...`); the Clerk migration file converts `public.users.id` and related columns from uuid.
- **Applying migrations (agents):** When the developer has `DATABASE_URL` in `.env.local` or `.env` (Supabase Dashboard → Project Settings → Database → connection URI with password), **run** migrations from the repo root instead of only instructing manual SQL Editor paste:
  - `node scripts/run-migration.cjs supabase/migrations/<file>.sql`
  - Shorthand: `npm run db:migrate:file -- supabase/migrations/<file>.sql`
  - Or named scripts where defined: `db:migrate:avatar-storage` / `db:migrate:avatar-search-rpc` / `db:migrate:clerk` / `db:migrate:last-seen`, etc.
  If `DATABASE_URL` is missing, the command will fail—then use SQL Editor as in `HOSTED_SETUP.md`. Never commit `DATABASE_URL`.
- **Skill ratings (global):** `public.player_ratings` + trigger on completed sessions; `sessions.skill_rating_applied_at` for idempotency. Spec and formulas: root `algorithm.md`. Migration: `supabase/migrations/20260330100000_player_skill_ratings.sql`.
- **Stats recalc concurrency:** Saving many games can fire stats recalculation repeatedly; concurrent saves used to race on `player_stats`. Migration `20260330110000_recalculate_league_stats_advisory_lock.sql` adds a per-league advisory lock inside `recalculate_all_league_stats`. Apply after earlier stats migrations if you see duplicate key on `player_stats_player_id_league_id_key`.
- **Sessions list / ordering:** `public.sessions.created_at` (migration `20260330120000_sessions_created_at.sql`) backs stable ordering when multiple sessions share a calendar date. League and session routes use `noStore()` and normalize `leagueId` to lowercase; prefer `prefetch={false}` on links to the league page after completing a session so the list is not a stale prefetched shell.
- **Clerk Dashboard** (email/password or OAuth, session lifetime; no Clerk username sign-in): see `docs/CLERK_DASHBOARD.md`. In-app `@username` lives in Supabase (`public.users.username`). Session length is configured in Clerk, not via stored IP.
- **Optional:** `last_seen_ip` / `last_seen_at` on `public.users` (migration `20250329100000_user_last_seen.sql`) are updated from request headers in `app/(app)/layout.tsx` via `maybeRecordLastSeenIp` (throttled); audit only.
