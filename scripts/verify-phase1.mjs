// Holistic Phase 1 acceptance gate: exercises phone search -> invite -> accept
// -> shared transaction -> cross-user RLS isolation, end to end, against a
// real Supabase project (local or hosted).
//
// "Signed in as" a given test user is simulated via a direct Postgres
// connection with request.jwt.claims set to that user's id (through the
// non-bypassrls `authenticated` role) rather than a real phone OTP sign-in:
// hosted Supabase has no local test_otp shortcut, and wiring up a real SMS
// provider is out of Phase 1's scope. User creation still goes through the
// real Supabase Auth admin API, so the auth.users -> profiles trigger is
// exercised for real.
//
// Safe to re-run: phone numbers are randomized per run, and every row this
// script creates is deleted again in the `finally` block.
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
const phoneFor = (n) => `+1555${runId}${n}`;

const createdUserIds = [];
let createdConnectionId = null;

// Supabase Auth's admin API normalizes stored phone numbers by stripping the
// leading "+" (createUser("+15550000000") stores "15550000000"). Returning
// the normalized phone alongside the id keeps exact-match phone search
// correct without re-deriving Supabase's normalization rule elsewhere.
async function createTestUser(phone) {
  const { data, error } = await admin.auth.admin.createUser({ phone, phone_confirm: true });
  assert.equal(error, null, `createUser(${phone}) failed: ${error?.message}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, phone: data.user.phone };
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
  const { id: userAId } = await createTestUser(phoneFor(1));
  const { id: userBId, phone: userBStoredPhone } = await createTestUser(phoneFor(2));
  const { id: userCId } = await createTestUser(phoneFor(3)); // unrelated third user

  const found = await asUser(userAId, () =>
    client.query("select id, display_name from public.search_profile_by_phone($1)", [userBStoredPhone])
  );
  assert.equal(found.rows.length, 1, "expected to find user B by exact phone match");
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
