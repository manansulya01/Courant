const baseUrl = process.env.COURANT_SMOKE_URL || "http://127.0.0.1:3000";

async function waitForServer() {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
      lastError = new Error(`Home page returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`The production server did not become ready: ${String(lastError)}`);
}

async function check(path, expectedStatus, init) {
  const response = await fetch(new URL(path, baseUrl), init);
  if (response.status !== expectedStatus) {
    throw new Error(`${init?.method || "GET"} ${path}: expected HTTP ${expectedStatus}, got ${response.status}`);
  }
  console.log(`PASS ${init?.method || "GET"} ${path} → ${response.status}`);
  return response;
}

await waitForServer();
const home = await check("/", 200);
if (home.headers.get("x-frame-options") !== "DENY") throw new Error("Missing X-Frame-Options security header.");
if (home.headers.get("x-content-type-options") !== "nosniff") throw new Error("Missing X-Content-Type-Options security header.");
for (const path of [
  "/labs", "/labs/confident-introduction", "/talk", "/offline-practice", "/local-tutor", "/login", "/signup", "/dashboard",
  "/teacher", "/creator", "/practice-plan", "/forgot-password", "/reset-password", "/settings",
]) await check(path, 200);
const localTutor = await check("/local-tutor", 200);
const localTutorHtml = await localTutor.text();
if (!localTutorHtml.includes("COURANT · LOCAL TEACHER") || !localTutorHtml.includes("not analysed by the local model")) throw new Error("Local teacher preview or camera privacy disclosure is missing.");
const practice = await check("/offline-practice", 200);
const practiceHtml = await practice.text();
if (!practiceHtml.includes("Download backup") || !practiceHtml.includes("Restore backup")) throw new Error("Offline progress backup controls are missing.");
const manifest = await check("/manifest.webmanifest", 200);
if (!(manifest.headers.get("content-type") || "").includes("json")) throw new Error("PWA manifest must be served as JSON.");
const icon = await check("/icon.svg", 200);
if (!(icon.headers.get("content-type") || "").includes("image/svg+xml")) throw new Error("PWA icon must be served as SVG.");
const worker = await check("/sw.js", 200);
const workerSource = await worker.text();
if (!workerSource.includes("/offline-practice") || !workerSource.includes("/api/")) throw new Error("Offline worker is missing route scope or private API exclusions.");
await check("/not-a-real-courant-route", 404);
const health = await check("/api/health", 503);
if (health.headers.get("cache-control") !== "no-store") throw new Error("API responses must disable caching.");
await check("/api/account", 401);
await check("/api/learning/progress", 401);
await check("/api/portfolio", 401);
await check("/api/assignments", 401);
await check("/api/assignments/submissions", 401);
await check("/api/teacher", 401);
await check("/api/tutor", 405);
await check("/api/tutor", 503, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "hello", scenario: "A confident introduction", history: [] }),
});
await check("/api/tutor/speech", 503, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: "Hello there." }),
});
await check("/api/tutor/realtime-session", 503, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" },
  body: JSON.stringify({ mode: "voice", scenario: "Smoke test" }),
});
await check("/api/tutor/avatar-token", 401, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" },
});
await check("/api/tutor/avatar-token", 403, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" },
});
await check("/api/tutor/transcribe", 503, { method: "POST", headers: {} });
await check("/api/account", 403, {
  method: "DELETE",
  headers: { "Content-Type": "application/json", "Origin": "https://attacker.example" },
  body: JSON.stringify({ confirmEmail: "nobody@example.com" }),
});
await check("/api/account", 401, {
  method: "DELETE",
  headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" },
  body: JSON.stringify({ confirmEmail: "nobody@example.com" }),
});
await check("/api/coach", 400, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ transcript: "   " }),
});
await check("/api/coach", 400, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{malformed-json",
});
await check("/api/coach", 400, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(["not", "an", "object"]),
});
await check("/api/coach", 413, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ transcript: "x".repeat(20_001) }),
});
await check("/api/coach", 413, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"transcript":"' + "x".repeat(30_000)));
      controller.close();
    },
  }),
  duplex: "half",
});
console.log("Courant production smoke checks passed.");
