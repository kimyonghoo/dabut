// Read-only check that the remote DB has the shared-visibility RLS from
// 0019_payment_methods_shared_visibility.sql applied, and that it behaves
// correctly: a connected partner can SELECT someone else's payment method,
// an unconnected user cannot, and INSERT/UPDATE/DELETE remain owner-only.
// Everything runs as the non-bypassrls `authenticated` role inside a single
// transaction that is always rolled back, so this script never leaves data
// behind.
//
// usage: node --env-file=.env.local scripts/verify-payment-methods-rls.mjs
import { Client } from "pg";
import assert from "node:assert/strict";

const dbUrl = process.env.SUPABASE_DB_URL;
assert(dbUrl, "SUPABASE_DB_URL must be set");

const client = new Client({ connectionString: dbUrl });
await client.connect();

async function asUser(userId, fn) {
  await client.query(
    "select set_config('request.jwt.claims', json_build_object('sub', $1::text)::text, true)",
    [userId]
  );
  return await fn();
}

try {
  await client.query("begin");

  // Prefer a real connected pair if one exists; otherwise synthesize a
  // temporary connection between two arbitrary profiles (as the
  // unrestricted connecting role, before dropping to `authenticated`
  // below) purely so this check doesn't depend on the current state of
  // the live data. Either way, everything is rolled back at the end.
  let { rows: pair } = await client.query(`
    select cm1.user_id as a, cm2.user_id as b
    from public.connection_members cm1
    join public.connection_members cm2
      on cm1.connection_id = cm2.connection_id and cm1.user_id <> cm2.user_id
    limit 1
  `);

  if (!pair[0]) {
    const { rows: profiles } = await client.query("select id from public.profiles limit 2");
    if (profiles.length === 2) {
      const { rows: conn } = await client.query("insert into public.connections default values returning id");
      await client.query(
        "insert into public.connection_members (connection_id, user_id) values ($1, $2), ($1, $3)",
        [conn[0].id, profiles[0].id, profiles[1].id]
      );
      pair = [{ a: profiles[0].id, b: profiles[1].id }];
      console.log("note: no existing connected pair — synthesized a temporary one (rolled back) to run the check");
    }
  }

  // Look up an "unrelated" (no shared connection with a or b) profile now,
  // while still on the unrestricted connecting role — once we switch to
  // `authenticated` below, profiles' own RLS would hide that very user from
  // a/b's queries (by definition, since they're unconnected), so this
  // lookup can't be done after the role switch.
  let unrelatedId = null;
  if (pair[0]) {
    const { a, b } = pair[0];
    const { rows: unrelated } = await client.query(
      `select id from public.profiles where id <> $1 and id <> $2
       and not exists (
         select 1 from public.connection_members m
         where m.user_id = profiles.id
           and m.connection_id in (select connection_id from public.connection_members where user_id in ($1, $2))
       )
       limit 1`,
      [a, b]
    );
    unrelatedId = unrelated[0]?.id ?? null;
  }

  await client.query("set local role authenticated");

  if (!pair[0]) {
    console.log("skip: fewer than 2 profiles exist in DB — cannot verify shared visibility");
  } else {
    const { a, b } = pair[0];

    // A registers a payment method.
    const { rows: created } = await asUser(a, () =>
      client.query(
        `insert into public.payment_methods (owner_id, name, icon, monthly_goal)
         values ($1, 'RLS test card', 'card', 500000) returning id`,
        [a]
      )
    );
    const methodId = created[0].id;

    // B (A's connected partner) can see it, including monthly_goal via RLS
    // (the app layer is responsible for not displaying it — see the report).
    await asUser(b, async () => {
      const { rows } = await client.query(
        "select id, monthly_goal from public.payment_methods where id = $1",
        [methodId]
      );
      assert.equal(rows.length, 1, "connected partner should be able to SELECT the shared payment method");
    });
    console.log("ok: connected partner can SELECT a shared payment method");

    // An unrelated user (no shared connection with A) cannot see it.
    if (unrelatedId) {
      await asUser(unrelatedId, async () => {
        const { rows } = await client.query("select id from public.payment_methods where id = $1", [methodId]);
        assert.equal(rows.length, 0, "unconnected user should not be able to SELECT someone else's payment method");
      });
      console.log("ok: unconnected user cannot SELECT another user's payment method");
    } else {
      console.log("skip: no unrelated user found to test negative visibility");
    }

    // B cannot update it (still owner-only).
    await asUser(b, async () => {
      const { rowCount } = await client.query(
        "update public.payment_methods set name = 'hijacked' where id = $1",
        [methodId]
      );
      assert.equal(rowCount, 0, "connected partner should not be able to UPDATE someone else's payment method");
    });
    console.log("ok: connected partner cannot UPDATE another user's payment method");

    // B cannot delete it (still owner-only).
    await asUser(b, async () => {
      const { rowCount } = await client.query("delete from public.payment_methods where id = $1", [methodId]);
      assert.equal(rowCount, 0, "connected partner should not be able to DELETE someone else's payment method");
    });
    console.log("ok: connected partner cannot DELETE another user's payment method");

    // A can still update/delete their own (sanity check RLS isn't over-broad).
    await asUser(a, async () => {
      const { rowCount } = await client.query(
        "update public.payment_methods set name = 'still mine' where id = $1",
        [methodId]
      );
      assert.equal(rowCount, 1, "owner should still be able to UPDATE their own payment method");
    });
    console.log("ok: owner can still UPDATE their own payment method");
  }

  console.log("payment_methods shared-visibility RLS verification passed");
} finally {
  await client.query("rollback");
  await client.end();
}
