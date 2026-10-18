// Read-only check that the remote DB has the solo-ledger RLS from
// 0011_personal_ledger_and_categories.sql applied, and that it behaves
// correctly for solo and paired users. Every insert runs as the non-bypassrls
// `authenticated` role inside a transaction that is always rolled back, so
// this script never leaves data behind.
//
// usage: node --env-file=.env.local scripts/verify-ledger-rls.mjs
import { Client } from "pg";
import assert from "node:assert/strict";

const dbUrl = process.env.SUPABASE_DB_URL;
assert(dbUrl, "SUPABASE_DB_URL must be set");

const client = new Client({ connectionString: dbUrl });
await client.connect();

async function asUserRolledBack(userId, fn) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query(
      "select set_config('request.jwt.claims', json_build_object('sub', $1::text)::text, true)",
      [userId]
    );
    return await fn();
  } finally {
    await client.query("rollback");
  }
}

const insertTx = (connectionId, userId, categoryId) =>
  client.query(
    `insert into public.transactions (connection_id, owner_id, created_by, category_id, type, amount, occurred_at)
     values ($1, $2, $2, $3, 'expense', 1000, current_date) returning id`,
    [connectionId, userId, categoryId]
  );

try {
  const { rows: cols } = await client.query(
    `select table_name, column_name, is_nullable from information_schema.columns
     where table_schema = 'public'
       and ((table_name = 'transactions' and column_name = 'connection_id')
         or (table_name = 'categories' and column_name = 'owner_id'))`
  );
  const txConn = cols.find((c) => c.table_name === "transactions");
  assert.equal(txConn?.is_nullable, "YES", "transactions.connection_id must be nullable (0011 not applied?)");
  assert(cols.some((c) => c.table_name === "categories"), "categories.owner_id missing (0011 not applied?)");

  const { rows: cats } = await client.query(
    `select id from public.categories where type = 'expense' and owner_id is null and connection_id is null limit 1`
  );
  assert(cats[0], "no global expense category found");
  const categoryId = cats[0].id;

  const { rows: solo } = await client.query(
    `select p.id from public.profiles p
     where not exists (select 1 from public.connection_members m where m.user_id = p.id) limit 1`
  );
  if (solo[0]) {
    await asUserRolledBack(solo[0].id, async () => {
      const r = await insertTx(null, solo[0].id, categoryId);
      assert.equal(r.rowCount, 1);
    });
    console.log("ok: solo user can insert a personal transaction");
  } else {
    console.log("skip: no solo user in DB");
  }

  const { rows: members } = await client.query(`select user_id, connection_id from public.connection_members limit 1`);
  if (members[0]) {
    const { user_id: userId, connection_id: connectionId } = members[0];
    await asUserRolledBack(userId, async () => {
      const r = await insertTx(connectionId, userId, categoryId);
      assert.equal(r.rowCount, 1);
    });
    console.log("ok: paired user can insert into their connection");

    await asUserRolledBack(userId, async () => {
      await assert.rejects(
        insertTx("00000000-0000-0000-0000-000000000001", userId, categoryId),
        /row-level security/
      );
    });
    console.log("ok: insert into a foreign connection is blocked");
  } else {
    console.log("skip: no paired user in DB");
  }

  console.log("ledger RLS verification passed");
} finally {
  await client.end();
}
