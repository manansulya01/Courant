import test from "node:test";
import assert from "node:assert/strict";
import { generateClassJoinCode, normalizeClassJoinCode } from "../lib/class-code.ts";

test("new class codes use eight uppercase alphanumeric characters", () => {
  for (let i = 0; i < 100; i++) {
    const code = generateClassJoinCode();
    assert.match(code, /^[A-Z0-9]{8}$/);
  }
});

test("normalizes legacy and new class codes", () => {
  assert.equal(normalizeClassJoinCode(" ab12 "), "AB12");
  assert.equal(normalizeClassJoinCode("abcd1234"), "ABCD1234");
});

test("rejects invalid lengths and characters", () => {
  for (const value of ["", "ABC", "ABCDE", "ABCDEFG", "ABCDEFGHI", "AB-1", null, 1234]) {
    assert.equal(normalizeClassJoinCode(value), null);
  }
});
