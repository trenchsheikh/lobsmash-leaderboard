# Hosted Supabase (no CLI)

## Option A: SQL Editor (recommended — no `DATABASE_URL`)

You do **not** need a database connection string on your machine. In **Supabase Dashboard → SQL Editor**, paste each migration file in order and click **Run**. Skip any step that was already applied.

Apply migrations **in this order**:

1. `migrations/20250328000000_init_schema.sql`
2. `migrations/20250328000001_rls_and_stats.sql`
3. `migrations/20250328000002_fix_league_create_rls.sql`
4. `migrations/20250328000003_users_username_league_guard.sql`
5. **`migrations/20250328120000_clerk_jwt_text_ids.sql`** — required for Clerk (`user_...` ids + JWT `sub` RLS)
6. `migrations/20250329000000_session_workflow.sql` — session wizard / `input_mode` / `session_teams`
7. `migrations/20250329110000_pair_championship_stats.sql` — pair championship leaderboard stats (`pair_championship_stats`, `recalculate_all_league_stats`)
8. `migrations/20250329130000_session_court1_pair_wins.sql` — champ mode `session_court1_pair_wins` + stats recalc updates (**requires step 7**)
8b. `migrations/20250329140000_league_results_mode.sql` — `leagues.results_mode` (full vs championship court only; locked at league creation)
9. `migrations/20250329100000_user_last_seen.sql` — optional `last_seen_ip` / `last_seen_at` on `public.users` (audit; app records IP throttled)
10. **`migrations/20250330120000_friendships.sql`** — friend requests/accept + friend visibility for stats
11. **`migrations/20260328120000_user_avatar_storage.sql`** — `public.users.avatar_url`, public `avatars` storage bucket + policies (upload/delete under `{clerk_user_id}/**`). **Does not** require `friendships`; safe to run alone for photo uploads.
12. **`migrations/20260328120001_search_users_friendship_avatar_url.sql`** — updates `search_users_for_friendship` to return `avatar_url`. **Requires step 10** (`public.friendships` must exist).

**Avatar uploads only:** run step 11. If you use friend search with avatars, apply step 10 first (if not already), then step 12.

If you use session features but applied step 6 before step 5, run step 5 anyway; it updates shared RLS helpers used by `session_teams` policies.

**Dashboard:** Authentication → Third-party → Clerk (domain matches Clerk Frontend API). In Clerk, use Connect with Supabase so session tokens include the `role` claim ([docs](https://supabase.com/docs/guides/auth/third-party/clerk)).

---

## Option B: Run a migration from your machine (needs `DATABASE_URL`)

Only use this if you want a one-off script instead of pasting in the dashboard. It requires your **database password** in `.env.local` as `DATABASE_URL` (not the anon key).

1. In **Supabase Dashboard → Project Settings → Database**, copy the **Connection string** (URI) and use your **database password**.
2. Add to `.env.local` (do not commit):

   `DATABASE_URL=postgresql://postgres...`

3. From the project root, use the npm shortcuts or pass a file path:

   | Command | Migration |
   | --- | --- |
   | `npm run db:migrate:clerk` | Clerk JWT / text ids |
   | `npm run db:migrate:pair-championship` | Pair championship stats (step 7) |
   | `npm run db:migrate:session-court1-wins` | Champ court-1 pair wins table + recalc (step 8) |
   | `npm run db:migrate:last-seen` | Optional last-seen columns |
   | `npm run db:migrate:friendships` | Friend requests + `search_users_for_friendship` (step 10) |
   | `npm run db:migrate:avatar-storage` | Avatars bucket + `avatar_url` |
   | `npm run db:migrate:avatar-search-rpc` | Friend search returns `avatar_url` (needs friendships) |
   | `npm run db:migrate:file -- supabase/migrations/ANY.sql` | Arbitrary single file |

   Same as: `node scripts/run-migration.cjs supabase/migrations/<file>.sql`

**Agents / automation:** If `DATABASE_URL` is present locally, prefer running these commands instead of only pasting into SQL Editor.

Then optionally: `npm run db:migrate:last-seen`

---

## Realtime (optional — league “live draft” updates)

The league page polls draft session data every **12 seconds** and also subscribes to **`public.sessions`** row changes filtered by `league_id` (so creating or updating a session triggers a refresh). No SQL migration is required for that subscription.

For **near-instant** updates when only `games`, `session_teams`, or `session_court1_pair_wins` change, enable **Realtime** replication for those tables in **Supabase Dashboard → Database → Publications** (or the Realtime settings UI for your project version), so Postgres changes broadcast to connected clients. The app does not require it; polling still picks up changes within the poll interval.

**In-app header notifications (session partner rows):** apply `migrations/20260410120000_user_notifications.sql` (creates `public.user_notifications`, RLS, and `sync_session_partner_notifications`). Use `npm run db:migrate:file -- supabase/migrations/20260410120000_user_notifications.sql` when `DATABASE_URL` is set, or paste into the SQL Editor.
