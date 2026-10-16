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
    throw new Error(`${path}: expected HTTP ${expectedStatus}, got ${response.status}`);
  }
  console.log(`PASS ${init?.method || "GET"} ${path} → ${response.status}`);
  return response;
}

await waitForServer();
const home = await check("/", 200);
if (home.headers.get("x-frame-options") !== "DENY") throw new Error("Missing X-Frame-Options security header.");
if (home.headers.get("x-content-type-options") !== "nosniff") throw new Error("Missing X-Content-Type-Options security header.");
await check("/labs", 200);
await check("/labs/confident-introduction", 200);
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
await check("/api/tutor/transcribe", 503, { method: "POST" });
await check("/api/coach", 400, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ transcript: "   " }),
});
const coachResponse = await check("/api/coach", 200, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ transcript: "I am ready to share a story today." }),
});
const coachData = await coachResponse.json();
if (!Number.isInteger(coachData.wordCount) || coachData.wordCount < 1) throw new Error("Coach returned an invalid word count.");
if (!coachData.feedback || typeof coachData.feedback.tip !== "string") throw new Error("Coach returned invalid feedback.");
console.log("PASS coach feedback payload");
console.log("Courant production smoke checks passed.");
