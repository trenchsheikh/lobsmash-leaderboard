#!/usr/bin/env node
/**
 * Verifies skill-rating DB objects are present (migrations applied).
 *
 * Usage:
 *   node scripts/verify-skill-rating-db.cjs
 *   node scripts/verify-skill-rating-db.cjs <session_uuid>   # optional: inspect one session row
 *
 * Requires DATABASE_URL in .env.local or .env (same as run-migration.cjs).
 *
 * Manual E2E (after completing a session in the app):
 *   1. Run with session id — expect status=completed and skill_rating_applied_at set.
 *   2. In SQL Editor or psql: select player_id, skill, rated_games from player_ratings order by updated_at desc limit 20;
 */

const path = require("path");
const { Client } = require("pg");

require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const sessionIdArg = process.argv[2];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "SKIP: DATABASE_URL not set — cannot verify DB. Add Supabase URI to .env.local when ready.",
    );
    process.exit(0);
  }

  const client = new Client({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const trigger = await client.query(
      `select trigger_name from information_schema.triggers
       where event_object_schema = 'public'
         and event_object_table = 'sessions'
         and trigger_name = 'sessions_apply_skill_rating'`,
    );
    if (trigger.rows.length === 0) {
      const any = await client.query(
        `select trigger_name from information_schema.triggers
         where event_object_schema = 'public' and event_object_table = 'sessions'
         order by trigger_name`,
      );
      console.error("FAIL: trigger public.sessions_apply_skill_rating not found.");
      console.error(
        "Existing triggers on public.sessions:",
        any.rows.length ? any.rows.map((r) => r.trigger_name).join(", ") : "(none)",
      );
      console.error("Apply migrations: npm run db:migrate:file -- supabase/migrations/20260330100000_player_skill_ratings.sql");
      process.exit(1);
    }
    console.log("OK: trigger sessions_apply_skill_rating on public.sessions");

    const funcs = await client.query(
      `select routine_name from information_schema.routines
       where routine_schema = 'public'
         and routine_name in ('apply_skill_rating_for_session', 'reverse_skill_rating_for_session')`,
    );
    const names = new Set(funcs.rows.map((r) => r.routine_name));
    for (const need of ["apply_skill_rating_for_session", "reverse_skill_rating_for_session"]) {
      if (!names.has(need)) {
        console.error(`FAIL: function public.${need} not found.`);
        process.exit(1);
      }
    }
    console.log("OK: functions apply_skill_rating_for_session, reverse_skill_rating_for_session");

    const col = await client.query(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'sessions' and column_name = 'skill_rating_applied_at'`,
    );
    if (col.rows.length === 0) {
      console.error("FAIL: column sessions.skill_rating_applied_at missing.");
      process.exit(1);
    }
    console.log("OK: column sessions.skill_rating_applied_at");

    if (sessionIdArg) {
      const sid = sessionIdArg.trim();
      const s = await client.query(
        `select id, status, skill_rating_applied_at, input_mode from public.sessions where id = $1`,
        [sid],
      );
      if (s.rows.length === 0) {
        console.error(`FAIL: no session with id ${sid}`);
        process.exit(1);
      }
      const row = s.rows[0];
      console.log("\nSession row:", {
        id: row.id,
        status: row.status,
        input_mode: row.input_mode,
        skill_rating_applied_at: row.skill_rating_applied_at,
      });
      if (row.status === "completed" && !row.skill_rating_applied_at) {
        console.error(
          "WARN: completed session but skill_rating_applied_at is null — rating may not have run.",
        );
        process.exit(1);
      }
      if (row.status === "completed" && row.skill_rating_applied_at) {
        console.log("OK: completed session has skill_rating_applied_at (rating applied).");
      }
    }

    console.log("\nAll skill-rating DB checks passed.");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
