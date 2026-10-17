import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import assert from "node:assert/strict";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
assert(
  url && serviceKey && dbUrl,
  "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_DB_URL must be set"
);

const admin = createClient(url, serviceKey);
const client = new Client({ connectionString: dbUrl });
await client.connect();

const runId = `${Date.now()}${Math.floor(Math.random() * 10000)}`.slice(-9);
const emailFor = (n) => `e2e-tg-${runId}-${n}@example.com`;
const createdUserIds = [];
let createdConnectionId = null;

async function createTestUser(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  assert.equal(error, null, `createUser(${email}) failed: ${error?.message}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id };
}

async function asUser(userId, fn) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query(
      "select set_config('request.jwt.claims', json_build_object('sub', $1::text)::text, true)",
      [userId]
    );
    const result = await fn();
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  }
}

try {
  const { id: userAId } = await createTestUser(emailFor("a"));
  const { id: userBId } = await createTestUser(emailFor("b"));

  const { data: connection } = await admin.from("connections").insert({}).select().single();
  createdConnectionId = connection.id;
  await admin.from("connection_members").insert([
    { connection_id: connection.id, user_id: userAId },
    { connection_id: connection.id, user_id: userBId },
  ]);

  await asUser(userAId, () =>
    client.query("insert into public.telegram_link_codes (user_id, code) values ($1, $2)", [
      userAId,
      "secret-code-a",
    ])
  );

  const bReadsA = await asUser(userBId, () =>
    client.query("select code from public.telegram_link_codes where user_id = $1", [userAId])
  );
  assert.equal(
    bReadsA.rows.length,
    0,
    "a connected partner must NOT be able to read another user's telegram link code"
  );

  const aReadsOwn = await asUser(userAId, () =>
    client.query("select code from public.telegram_link_codes where user_id = $1", [userAId])
  );
  assert.equal(
    aReadsOwn.rows[0]?.code,
    "secret-code-a",
    "the owner must still be able to read their own code"
  );

  console.log("Telegram link code RLS check: PASS");
} finally {
  if (createdConnectionId) {
    await admin.from("connections").delete().eq("id", createdConnectionId);
  }
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId);
  }
  await client.end();
}
