// Holistic Phase 1 acceptance gate: exercises email search -> invite -> accept
// -> shared transaction -> cross-user RLS isolation, end to end, against a
// real Supabase project (local or hosted).
//
// "Signed in as" a given test user is simulated via a direct Postgres
// connection with request.jwt.claims set to that user's id (through the
// non-bypassrls `authenticated` role) rather than a real email confirmation
// sign-in: there is no local-only shortcut for confirming a real inbox, and
// wiring up a test mailbox is out of Phase 1's scope. User creation still
// goes through the real Supabase Auth admin API, so the auth.users ->
// profiles trigger is exercised for real.
//
// Safe to re-run: emails are randomized per run, and every row this script
// creates is deleted again in the `finally` block.
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
const emailFor = (n) => `e2e-${runId}-${n}@example.com`;

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
  const userBEmail = emailFor("b");
  const { id: userBId } = await createTestUser(userBEmail);
  const { id: userCId } = await createTestUser(emailFor("c")); // unrelated third user

  const found = await asUser(userAId, () =>
    // Mixed-case search on purpose: proves the case-insensitive match, not
    // just an exact byte-for-byte one.
    client.query("select id, display_name from public.search_profile_by_email($1)", [userBEmail.toUpperCase()])
  );
  assert.equal(found.rows.length, 1, "expected to find user B by case-insensitive email match");
  assert.equal(found.rows[0].id, userBId);

  const invitation = await asUser(userAId, () =>
    client.query(
      "insert into public.connection_invitations (inviter_id, invitee_id) values ($1, $2) returning id",
      [userAId, userBId]
    )
  );
  const invitationId = invitation.rows[0].id;

  const accept = await asUser(userBId, () =>
    client.query("select public.accept_connection_invitation($1) as connection_id", [invitationId])
  );
  createdConnectionId = accept.rows[0].connection_id;
  assert.ok(createdConnectionId, "accept_connection_invitation should return a connection id");

  await assert.rejects(
    () =>
      asUser(userAId, () =>
        client.query(
          "insert into public.connection_invitations (inviter_id, invitee_id) values ($1, $2)",
          [userAId, userBId]
        )
      ),
    /row-level security/,
    "already-connected users must not be able to invite each other again"
  );

  const category = await asUser(userAId, () =>
    client.query("select id from public.categories where name = $1", ["식비"])
  );
  const categoryId = category.rows[0].id;

  await asUser(userAId, () =>
    client.query(
      `insert into public.transactions (connection_id, owner_id, category_id, type, amount, memo, created_by)
       values ($1, $2, $3, 'expense', 15000, 'e2e test', $2)`,
      [createdConnectionId, userAId, categoryId]
    )
  );

  const bSeesTx = await asUser(userBId, () =>
    client.query("select memo from public.transactions where memo = $1", ["e2e test"])
  );
  assert.equal(bSeesTx.rows.length, 1, "connected partner must see the transaction");

  const cSeesTx = await asUser(userCId, () =>
    client.query("select memo from public.transactions where memo = $1", ["e2e test"])
  );
  assert.equal(cSeesTx.rows.length, 0, "unrelated user must NOT see the transaction");

  const cSeesConnection = await asUser(userCId, () =>
    client.query("select id from public.connections where id = $1", [createdConnectionId])
  );
  assert.equal(cSeesConnection.rows.length, 0, "unrelated user must NOT see the connection row");

  console.log("Phase 1 acceptance script: PASS");
} finally {
  if (createdConnectionId) {
    await admin.from("connections").delete().eq("id", createdConnectionId);
  }
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId);
  }
  await client.end();
}
