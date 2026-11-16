import { spawn } from "node:child_process";

const port = 4100 + (process.pid % 1000);
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PORT: String(port),
  COURANT_SMOKE_URL: baseUrl,
  // Keep the smoke run isolated from production data and provider quotas.
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_placeholder",
  COURANT_RATE_LIMIT_SECRET: "0".repeat(64),
  GEMINI_API_KEY: "ci-placeholder",
};

const server = spawn(process.execPath, [
  "node_modules/next/dist/bin/next",
  "start",
  "--hostname",
  "127.0.0.1",
  "--port",
  String(port),
], { env, stdio: "inherit" });

try {
  const smoke = spawn(process.execPath, ["scripts/smoke.mjs"], { env, stdio: "inherit" });
  const code = await new Promise((resolve, reject) => {
    smoke.once("error", reject);
    smoke.once("exit", value => resolve(value ?? 1));
  });
  if (code !== 0) throw new Error(`Production smoke tests failed with exit code ${code}.`);
} finally {
  server.kill("SIGTERM");
}
