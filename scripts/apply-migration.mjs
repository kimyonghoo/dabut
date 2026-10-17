import { readFileSync } from "node:fs";
import { Client } from "pg";
import assert from "node:assert/strict";

const file = process.argv[2];
assert(file, "usage: node scripts/apply-migration.mjs <path-to-migration.sql>");
const sql = readFileSync(file, "utf8");

const dbUrl = process.env.SUPABASE_DB_URL;
assert(dbUrl, "SUPABASE_DB_URL must be set");

const client = new Client({ connectionString: dbUrl });
await client.connect();
try {
  await client.query(sql);
  console.log(`Applied ${file}`);
} finally {
  await client.end();
}
