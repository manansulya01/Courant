import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedJson } from "../lib/bounded-json.ts";

test("accepts a bounded JSON object", async () => {
  const request = new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lesson: "Introductions", minutes: 5 }),
  });
  assert.deepEqual(await readBoundedJson(request, 256), {
    ok: true,
    value: { lesson: "Introductions", minutes: 5 },
  });
});

test("rejects malformed JSON", async () => {
  const request = new Request("http://localhost/api/test", { method: "POST", body: "{bad" });
  const result = await readBoundedJson(request, 256);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
});

test("rejects JSON primitives and arrays", async () => {
  for (const body of ["null", "[]", "42", '"text"']) {
    const request = new Request("http://localhost/api/test", { method: "POST", body });
    const result = await readBoundedJson(request, 256);
    assert.equal(result.ok, false, body);
    if (!result.ok) assert.equal(result.status, 400, body);
  }
});

test("rejects oversized declared bodies before parsing", async () => {
  const request = new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Length": "1024" },
    body: '{"ok":true}',
  });
  const result = await readBoundedJson(request, 32);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 413);
});

test("rejects oversized streamed bodies when Content-Length is absent", async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"text":"' + "x".repeat(1024)));
      controller.close();
    },
  });
  const request = new Request("http://localhost/api/test", {
    method: "POST",
    body,
    duplex: "half",
  });
  assert.equal(request.headers.get("content-length"), null);
  const result = await readBoundedJson(request, 32);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 413);
});
