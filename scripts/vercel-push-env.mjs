// Push env vars from .env.local to the linked Vercel project (see .vercel/project.json)
// using the Vercel CLI. Existing values are replaced.
//
// Usage (run from the project root):
//   node scripts/vercel-push-env.mjs                 # TELEGRAM_* vars -> production
//   node scripts/vercel-push-env.mjs --deploy        # ...then run a production deploy
//   node scripts/vercel-push-env.mjs --env=preview   # target another environment
//   node scripts/vercel-push-env.mjs FOO BAR         # push specific keys instead
//
// Requires a one-time `npx vercel login` on this machine.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const DEFAULT_KEYS = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_USERNAME", "TELEGRAM_WEBHOOK_SECRET"];

const args = process.argv.slice(2);
const deploy = args.includes("--deploy");
const target = (args.find((a) => a.startsWith("--env=")) ?? "--env=production").slice(6);
const keys = args.filter((a) => !a.startsWith("--"));
const wanted = keys.length > 0 ? keys : DEFAULT_KEYS;

function parseEnvFile(path) {
  const vars = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    vars[line.slice(0, eq).trim()] = value;
  }
  return vars;
}

const env = parseEnvFile(".env.local");
const missing = wanted.filter((k) => !env[k]);
assert.equal(missing.length, 0, `missing or empty in .env.local: ${missing.join(", ")}`);

function vercel(cliArgs, input) {
  return spawnSync("npx", ["--yes", "vercel@latest", ...cliArgs], {
    input,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: [input === undefined ? "inherit" : "pipe", "pipe", "pipe"],
  });
}

for (const key of wanted) {
  // Remove first so re-runs replace the value (ignore "not found").
  vercel(["env", "rm", key, target, "--yes"], "");
  const result = vercel(["env", "add", key, target], env[key]);
  if (result.status !== 0) {
    console.error(`FAILED ${key}:\n${result.stderr || result.stdout}`);
    process.exit(1);
  }
  console.log(`set ${key} (${target})`);
}

if (deploy) {
  console.log("Deploying to production...");
  const result = spawnSync("npx", ["--yes", "vercel@latest", "deploy", "--prod"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  process.exit(result.status ?? 1);
} else {
  console.log("Done. Values apply from the next deployment (git push, or re-run with --deploy).");
}
