import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && serviceKey, "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");

const admin = createClient(url, serviceKey);

let received = false;
const channel = admin
  .channel("verify-realtime-smoke")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, () => {
    received = true;
  })
  .subscribe();

await new Promise((resolve) => setTimeout(resolve, 2000));

const { data: user } = await admin.auth.admin.createUser({
  email: `rt-smoke-${Date.now()}@example.com`,
  email_confirm: true,
});

const { data: inserted } = await admin
  .from("events")
  .insert({
    owner_id: user.user.id,
    created_by: user.user.id,
    title: "realtime smoke test",
    all_day: true,
    start_at: new Date().toISOString(),
  })
  .select()
  .single();

await new Promise((resolve) => setTimeout(resolve, 3000));

await admin.from("events").delete().eq("id", inserted.id);
await admin.auth.admin.deleteUser(user.user.id);
await channel.unsubscribe();

assert.ok(
  received,
  "expected a postgres_changes event for the INSERT on events — Realtime publication may not be active"
);
console.log("Realtime smoke test: PASS");
process.exit(0);
