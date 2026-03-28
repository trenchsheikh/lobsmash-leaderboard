#!/usr/bin/env node
/**
 * Run a single SQL migration file against Postgres (hosted Supabase).
 *
 * 1. Supabase Dashboard → Project Settings → Database → Connection string → URI
 *    (use Session mode; replace [YOUR-PASSWORD] with the database password)
 * 2. Add to .env.local:
 *      DATABASE_URL=postgresql://postgres.[ref]:PASSWORD@...pooler.supabase.com:6543/postgres
 * 3. Run: npm run db:migrate:clerk
 *
 * Do not commit DATABASE_URL.
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error("Usage: node scripts/run-migration.cjs <path-to.sql>");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "Missing DATABASE_URL. Add your Sup Postgres URI to .env.local (Dashboard → Settings → Database).",
  );
  process.exit(1);
}

async function main() {
  const sqlPath = path.resolve(process.cwd(), migrationFile);
  if (!fs.existsSync(sqlPath)) {
    console.error("File not found:", sqlPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, "utf8");
  const client = new Client({
    connectionString: url,
    ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Applied:", migrationFile);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
