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
7. `migrations/20250329100000_user_last_seen.sql` — optional `last_seen_ip` / `last_seen_at` on `public.users` (audit; app records IP throttled)
8. **`migrations/20250330120000_friendships.sql`** — friend requests/accept + friend visibility for stats
9. **`migrations/20260328120000_user_avatar_storage.sql`** — `public.users.avatar_url`, public `avatars` storage bucket + policies (upload/delete under `{clerk_user_id}/**`). **Does not** require `friendships`; safe to run alone for photo uploads.
10. **`migrations/20260328120001_search_users_friendship_avatar_url.sql`** — updates `search_users_for_friendship` to return `avatar_url`. **Requires step 8** (`public.friendships` must exist).

**Avatar uploads only:** run step 9. If you use friend search with avatars, apply step 8 first (if not already), then step 10.

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
   | `npm run db:migrate:last-seen` | Optional last-seen columns |
   | `npm run db:migrate:friendships` | Friend requests + `search_users_for_friendship` (step 8) |
   | `npm run db:migrate:avatar-storage` | Avatars bucket + `avatar_url` |
   | `npm run db:migrate:avatar-search-rpc` | Friend search returns `avatar_url` (needs friendships) |
   | `npm run db:migrate:file -- supabase/migrations/ANY.sql` | Arbitrary single file |

   Same as: `node scripts/run-migration.cjs supabase/migrations/<file>.sql`

**Agents / automation:** If `DATABASE_URL` is present locally, prefer running these commands instead of only pasting into SQL Editor.

Then optionally: `npm run db:migrate:last-seen`
