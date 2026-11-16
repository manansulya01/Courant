import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimitKey } from "../lib/rate-limit-key.ts";

test("creates the exact key format required by the database RPC", () => {
  const key = createRateLimitKey("tutor", "203.0.113.10");
  assert.match(key, /^tutor:[0-9a-f]{32}$/);
  assert.equal(key.length, "tutor:".length + 32);
});

test("keys are deterministic but differ by scope and client address", () => {
  const first = createRateLimitKey("tutor", "203.0.113.10");
  assert.equal(first, createRateLimitKey("tutor", "203.0.113.10"));
  assert.notEqual(first, createRateLimitKey("speech", "203.0.113.10"));
  assert.notEqual(first, createRateLimitKey("tutor", "203.0.113.11"));
});

test("keys never contain the original client address", () => {
  const key = createRateLimitKey("account-delete", "203.0.113.10");
  assert.equal(key.includes("203.0.113.10"), false);
  assert.match(key, /^account-delete:[0-9a-f]{32}$/);
});
