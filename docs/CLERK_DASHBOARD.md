# Clerk Dashboard (manual setup)

These steps are done in [Clerk Dashboard](https://dashboard.clerk.com), not in this repo.

## Sign-in (email + password / OAuth; no Clerk username)

This app does **not** use Clerk’s **Username** identifier. Users sign in with **email** (and password and/or OAuth) only.

1. Open **User & Authentication** (or **Identifiers**).
2. **Disable** or leave **Username** turned **off** so users do not sign in with a Clerk username.
3. Under **Authentication strategies**, enable what you need (e.g. **Password** with **Email**, and optional OAuth providers).
4. In **Sign-in / Sign-up** settings, allow only the strategies you want (without username-based sign-in).

The embedded `<SignIn />` at `/login` reflects these settings.

**Note:** The in-app **`@username`** on profiles and leagues is stored in **Supabase** (`public.users.username`), not in Clerk. It is independent of Clerk identifiers.

## Session persistence (fewer logouts)

Session length is controlled by Clerk, **not** by storing IP in Postgres.

1. Open **Sessions** (or **Session management**, depending on Clerk version).
2. Adjust **session lifetime**, **inactivity timeout**, and related options to match how long users should stay signed in.
3. Keep **Connect with Supabase** configured so session tokens work with [Supabase third-party auth](https://supabase.com/docs/guides/auth/third-party/clerk).

Optional: this app records **`last_seen_ip`** / **`last_seen_at`** in `public.users` for audit/debug only; it does not replace Clerk session settings.
